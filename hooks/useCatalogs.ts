"use client";

/**
 * Nomencladores del admin de plataforma (bloque 3, 2026-09-26): los siete
 * catálogos vivos del backend, con lectura y escritura `IsAdminUser`
 * (`is_staff`). A staff el backend le sirve también las filas inactivas.
 *
 * Tres formas de listado distintas, normalizadas aquí a `CatalogItem[]`:
 * - **array plano**: `catalogs/views.py` (idiomas, aficiones y sus
 *   categorías, `pagination_class = None`) y subcategorías de comunidad;
 * - **paginación estándar** (20 por página): categorías de comunidad — se
 *   recorren todas las páginas con un tope (`MAX_PAGES`);
 * - **`{results, count}` sin paginar**: categorías y subcategorías de
 *   actividad (`events/viewsets.py::_CatalogoViewSet.list`).
 *
 * Ids enteros (idiomas, aficiones, categorías de afición y de actividad) y
 * UUID (categorías/subcategorías de comunidad y subcategorías de
 * actividad): se normalizan a cadena para las claves de React; la ruta de
 * detalle acepta los dos.
 *
 * **Un 500 al escribir no es un fallo cualquiera**: el backend (DRF 3.14)
 * no valida los `UniqueConstraint` de modelo ni convierte `ProtectedError`
 * en 400, así que borrar una categoría de afición con aficiones o repetir
 * el nombre de una subcategoría en la misma categoría llegan como 500
 * genérico. Se traducen a `conflicto_servidor`, con una pista, sin
 * inventar un motivo exacto.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { CATALOGS } from "@/lib/api/endpoints";
import type { Paginated } from "@/lib/api/types";

export const CATALOG_KEYS = [
  "languages",
  "hobbyCategories",
  "hobbies",
  "communityCategories",
  "communitySubcategories",
  "eventCategories",
  "eventSubcategories",
] as const;

export type CatalogKey = (typeof CATALOG_KEYS)[number];

/** Campos de formulario que puede tener un catálogo. */
export type CatalogField = "code" | "label" | "order" | "emoji" | "parent" | "categoryType" | "description" | "icon";

export const EVENT_CATEGORY_TYPES = ["sports", "cultural", "leisure", "travel", "party", "motorcycle", "other"] as const;
export type EventCategoryType = (typeof EVENT_CATEGORY_TYPES)[number];

/** Fila normalizada, común a los siete catálogos. */
export interface CatalogItem {
  id: string;
  label: string;
  code: string | null;
  order: number | null;
  emoji: string | null;
  /** Id (como cadena) de la categoría padre, para las subcategorías y aficiones. */
  parent: string | null;
  categoryType: string | null;
  description: string | null;
  icon: string | null;
  /** Comunidades activas de una categoría de comunidad (solo lectura). */
  count: number | null;
  isActive: boolean;
}

/** Valores del formulario de alta/edición. */
export interface CatalogFormValues {
  code: string;
  label: string;
  order: string;
  emoji: string;
  parent: string;
  categoryType: string;
  description: string;
  icon: string;
  isActive: boolean;
}

type ListShape = "flat" | "paginated" | "results";
type RawRow = Record<string, unknown>;

interface CatalogConfig {
  list: () => string;
  detail: (id: string) => string;
  shape: ListShape;
  fields: readonly CatalogField[];
  /** Catálogo del que salen las opciones de `parent`. */
  parentCatalog?: CatalogKey;
  normalize: (row: RawRow) => CatalogItem;
  toPayload: (values: CatalogFormValues) => Record<string, unknown>;
}

function str(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function num(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function base(row: RawRow, labelField: "label" | "name"): CatalogItem {
  return {
    id: String(row.id),
    label: String(row[labelField] ?? ""),
    code: str(row.code),
    order: num(row.order),
    emoji: str(row.emoji),
    parent: null,
    categoryType: str(row.category_type),
    description: str(row.description),
    icon: str(row.icon),
    count: num(row.communities_count),
    isActive: row.is_active !== false,
  };
}

function orderValue(values: CatalogFormValues): number {
  const parsed = Number.parseInt(values.order, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function codedPayload(values: CatalogFormValues): Record<string, unknown> {
  return {
    code: values.code.trim(),
    label: values.label.trim(),
    order: orderValue(values),
    is_active: values.isActive,
  };
}

export const CATALOG_CONFIG: Record<CatalogKey, CatalogConfig> = {
  languages: {
    list: CATALOGS.LANGUAGES,
    detail: CATALOGS.LANGUAGE,
    shape: "flat",
    fields: ["code", "label", "order"],
    normalize: (row) => base(row, "label"),
    toPayload: codedPayload,
  },
  hobbyCategories: {
    list: CATALOGS.HOBBY_CATEGORIES,
    detail: CATALOGS.HOBBY_CATEGORY,
    shape: "flat",
    fields: ["code", "label", "emoji", "order"],
    normalize: (row) => base(row, "label"),
    toPayload: (values) => ({ ...codedPayload(values), emoji: values.emoji.trim() }),
  },
  hobbies: {
    list: CATALOGS.HOBBIES,
    detail: CATALOGS.HOBBY,
    shape: "flat",
    fields: ["code", "label", "parent", "order"],
    parentCatalog: "hobbyCategories",
    normalize: (row) => ({ ...base(row, "label"), parent: str(row.category) }),
    toPayload: (values) => ({ ...codedPayload(values), category: Number(values.parent) }),
  },
  communityCategories: {
    list: CATALOGS.COMMUNITY_CATEGORIES,
    detail: CATALOGS.COMMUNITY_CATEGORY,
    shape: "paginated",
    fields: ["label", "emoji"],
    normalize: (row) => base(row, "name"),
    // Sin `image`: el panel no sube la imagen, y no mandarla la conserva.
    toPayload: (values) => ({ name: values.label.trim(), emoji: values.emoji.trim(), is_active: values.isActive }),
  },
  communitySubcategories: {
    list: CATALOGS.COMMUNITY_SUBCATEGORIES,
    detail: CATALOGS.COMMUNITY_SUBCATEGORY,
    shape: "flat",
    fields: ["label", "parent"],
    parentCatalog: "communityCategories",
    normalize: (row) => ({ ...base(row, "name"), parent: str(row.category) }),
    toPayload: (values) => ({ name: values.label.trim(), category: values.parent, is_active: values.isActive }),
  },
  eventCategories: {
    list: CATALOGS.EVENT_CATEGORIES,
    detail: CATALOGS.EVENT_CATEGORY,
    shape: "results",
    fields: ["label", "categoryType", "icon", "description"],
    normalize: (row) => base(row, "name"),
    toPayload: (values) => ({
      name: values.label.trim(),
      category_type: values.categoryType,
      icon: values.icon.trim(),
      description: values.description.trim(),
      is_active: values.isActive,
    }),
  },
  eventSubcategories: {
    list: CATALOGS.EVENT_SUBCATEGORIES,
    detail: CATALOGS.EVENT_SUBCATEGORY,
    shape: "results",
    fields: ["label", "parent"],
    parentCatalog: "eventCategories",
    // `category` es de solo escritura; la lectura lo trae en `category_id`
    // (cadena del id entero, aunque el serializer lo declare UUID).
    normalize: (row) => ({ ...base(row, "name"), parent: str(row.category_id) }),
    toPayload: (values) => ({ name: values.label.trim(), category: Number(values.parent), is_active: values.isActive }),
  },
};

export type CatalogsErrorKind =
  | "invalido"
  | "sin_acceso"
  | "no_encontrado"
  | "conflicto_servidor"
  | "demasiadas_paginas"
  | "desconocido";

export class CatalogsError extends Error {
  readonly kind: CatalogsErrorKind;
  readonly detail?: string;

  constructor(kind: CatalogsErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "CatalogsError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toError(error: unknown, fallback: string): CatalogsError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      const detail = detailOf(error);
      return new CatalogsError("invalido", detail ?? "Revisa los datos.", detail);
    }
    if (error.status === 403) return new CatalogsError("sin_acceso", "Solo el personal de plataforma edita los nomencladores.");
    if (error.status === 404) return new CatalogsError("no_encontrado", "Ese elemento ya no existe.");
    if (error.status >= 500) {
      return new CatalogsError(
        "conflicto_servidor",
        "El servidor no lo aceptó: puede que el elemento esté en uso o que el nombre esté repetido.",
      );
    }
  }
  return new CatalogsError("desconocido", fallback);
}

/** Tope de páginas de las categorías de comunidad (20 por página). */
export const MAX_PAGES = 50;

async function fetchRows(config: CatalogConfig): Promise<RawRow[]> {
  if (config.shape === "flat") return apiFetch<RawRow[]>(config.list());
  if (config.shape === "results") return (await apiFetch<{ results: RawRow[] }>(config.list())).results;
  const rows: RawRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await apiFetch<Paginated<RawRow>>(`${config.list()}?page=${page}`);
    rows.push(...data.results);
    if (!data.next) return rows;
  }
  throw new CatalogsError("demasiadas_paginas", "Hay demasiadas categorías para cargarlas todas.");
}

export const CATALOG_QUERY_KEY = "panel-catalog";

export function useCatalog(key: CatalogKey | null): UseQueryResult<CatalogItem[], CatalogsError> {
  return useQuery<CatalogItem[], CatalogsError>({
    queryKey: [CATALOG_QUERY_KEY, key],
    queryFn: async () => {
      const config = CATALOG_CONFIG[key as CatalogKey];
      try {
        return (await fetchRows(config)).map(config.normalize);
      } catch (error) {
        if (error instanceof CatalogsError) throw error;
        throw toError(error, "No se pudo cargar el nomenclador.");
      }
    },
    enabled: key !== null,
  });
}

export interface SaveCatalogItemInput {
  /** `null` crea; un id edita. */
  id: string | null;
  values: CatalogFormValues;
}

function invalidateCatalogs(queryClient: ReturnType<typeof useQueryClient>): void {
  // Todo el prefijo: una categoría cambiada afecta a las opciones de padre
  // de su catálogo hijo.
  void queryClient.invalidateQueries({ queryKey: [CATALOG_QUERY_KEY] });
}

export function useSaveCatalogItem(key: CatalogKey): UseMutationResult<unknown, CatalogsError, SaveCatalogItemInput> {
  const queryClient = useQueryClient();
  return useMutation<unknown, CatalogsError, SaveCatalogItemInput>({
    mutationFn: async ({ id, values }) => {
      const config = CATALOG_CONFIG[key];
      const body = config.toPayload(values);
      try {
        return id === null
          ? await apiFetch(config.list(), { method: "POST", body })
          : await apiFetch(config.detail(id), { method: "PATCH", body });
      } catch (error) {
        throw toError(error, "No se pudo guardar.");
      }
    },
    onSuccess: () => invalidateCatalogs(queryClient),
  });
}

export function useDeleteCatalogItem(key: CatalogKey): UseMutationResult<void, CatalogsError, string> {
  const queryClient = useQueryClient();
  return useMutation<void, CatalogsError, string>({
    mutationFn: async (id) => {
      try {
        await apiFetch(CATALOG_CONFIG[key].detail(id), { method: "DELETE" });
      } catch (error) {
        throw toError(error, "No se pudo borrar.");
      }
    },
    onSuccess: () => invalidateCatalogs(queryClient),
  });
}
