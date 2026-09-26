"use client";

/**
 * Catálogo de entrenamiento en Nomencladores de plataforma (2026-09-26,
 * `docs/PANEL.md` §17.1-§17.2 del backend): disciplinas, ejercicios y
 * plantillas **de Popyplan**. Leer lo puede cualquier cuenta; escribir,
 * `is_staff` o `PlatformRole` superadmin (403 al resto).
 *
 * Tres reglas del contrato que viven aquí:
 *
 * - Los tres listados **paginan** (20 por página) y se recorren enteros
 *   con un tope (`MAX_PAGES`) que **lanza** en vez de truncar en silencio.
 * - Las plantillas se piden **siempre** con `?scope=system`. El panel no
 *   lista nunca rutinas de nadie — ni siquiera las del propio staff
 *   (`scope=mine`), que no pintan nada en un catálogo. Este módulo no
 *   tiene, a propósito, ninguna función contra entrenos, rutinas ni
 *   perfiles deportivos: el entrenamiento es privado.
 * - Borrar una disciplina en uso responde **409** con el `detail` literal
 *   («Está en uso y no se puede borrar; desactívalo en su lugar.»):
 *   `kind: "en_uso"` con ese texto en `detail`.
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
import { TRAINING } from "@/lib/api/endpoints";
import type {
  Paginated,
  TrainingDiscipline,
  TrainingDisciplineWrite,
  TrainingExercise,
  TrainingExerciseWrite,
  TrainingTemplate,
  TrainingTemplateWrite,
} from "@/lib/api/types";

export type TrainingCatalogErrorKind =
  | "invalido"
  | "sin_acceso"
  | "no_encontrado"
  | "en_uso"
  | "demasiadas_paginas"
  | "desconocido";

export class TrainingCatalogError extends Error {
  readonly kind: TrainingCatalogErrorKind;
  readonly detail?: string;

  constructor(kind: TrainingCatalogErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "TrainingCatalogError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toError(error: unknown, fallback: string): TrainingCatalogError {
  if (error instanceof TrainingCatalogError) return error;
  if (error instanceof ApiError) {
    const detail = detailOf(error);
    if (error.status === 400) return new TrainingCatalogError("invalido", detail ?? "Revisa los datos.", detail);
    if (error.status === 403) {
      return new TrainingCatalogError(
        "sin_acceso",
        detail ?? "Solo superadmin gestiona el catálogo de entrenamiento.",
        detail,
      );
    }
    if (error.status === 404) return new TrainingCatalogError("no_encontrado", "Ese elemento ya no existe.");
    if (error.status === 409) {
      return new TrainingCatalogError("en_uso", detail ?? "Está en uso y no se puede borrar.", detail);
    }
  }
  return new TrainingCatalogError("desconocido", fallback);
}

/** Tope de páginas de cada listado (20 por página). */
export const MAX_PAGES = 50;

async function fetchAll<Row>(url: string): Promise<Row[]> {
  const separator = url.includes("?") ? "&" : "?";
  const rows: Row[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await apiFetch<Paginated<Row>>(`${url}${separator}page=${page}`);
    rows.push(...data.results);
    if (!data.next) return rows;
  }
  throw new TrainingCatalogError("demasiadas_paginas", "Hay demasiados elementos para cargarlos todos.");
}

export const TRAINING_QUERY_KEY = "panel-training-catalog";

function listQuery<Row>(key: unknown[], url: string, enabled = true) {
  return {
    queryKey: [TRAINING_QUERY_KEY, ...key],
    queryFn: async () => {
      try {
        return await fetchAll<Row>(url);
      } catch (error) {
        throw toError(error, "No se pudo cargar el catálogo de entrenamiento.");
      }
    },
    enabled,
  };
}

/** Todas las disciplinas (a quien gestiona, también las inactivas). */
export function useTrainingDisciplines(): UseQueryResult<TrainingDiscipline[], TrainingCatalogError> {
  return useQuery<TrainingDiscipline[], TrainingCatalogError>(
    listQuery<TrainingDiscipline>(["disciplines"], TRAINING.DISCIPLINES()),
  );
}

/**
 * Ejercicios, de una disciplina (`?discipline=<id>`) o de todas (`null`).
 * `enabled: false` no pide nada (el formulario de plantilla sin disciplina
 * elegida todavía).
 */
export function useTrainingExercises(
  disciplineId: number | null,
  enabled = true,
): UseQueryResult<TrainingExercise[], TrainingCatalogError> {
  const url =
    disciplineId === null ? TRAINING.EXERCISES() : `${TRAINING.EXERCISES()}?discipline=${disciplineId}`;
  return useQuery<TrainingExercise[], TrainingCatalogError>(
    listQuery<TrainingExercise>(["exercises", disciplineId === null ? "all" : String(disciplineId)], url, enabled),
  );
}

/** Solo las plantillas de Popyplan (`?scope=system`), nunca rutinas de nadie. */
export function useSystemTemplates(): UseQueryResult<TrainingTemplate[], TrainingCatalogError> {
  return useQuery<TrainingTemplate[], TrainingCatalogError>(
    listQuery<TrainingTemplate>(["templates"], `${TRAINING.TEMPLATES()}?scope=system`),
  );
}

interface SaveInput<Body> {
  /** `null` crea; un id edita (`PATCH`). */
  id: number | null;
  body: Body;
}

function useSave<Body>(
  list: () => string,
  detail: (id: number) => string,
): UseMutationResult<unknown, TrainingCatalogError, SaveInput<Body>> {
  const queryClient = useQueryClient();
  return useMutation<unknown, TrainingCatalogError, SaveInput<Body>>({
    mutationFn: async ({ id, body }) => {
      try {
        return id === null
          ? await apiFetch(list(), { method: "POST", body })
          : await apiFetch(detail(id), { method: "PATCH", body });
      } catch (error) {
        throw toError(error, "No se pudo guardar.");
      }
    },
    // Todo el prefijo: una disciplina cambiada afecta a los ejercicios y
    // plantillas que la pintan, y un ejercicio renombrado a las plantillas.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [TRAINING_QUERY_KEY] }),
  });
}

function useRemove(detail: (id: number) => string): UseMutationResult<void, TrainingCatalogError, number> {
  const queryClient = useQueryClient();
  return useMutation<void, TrainingCatalogError, number>({
    mutationFn: async (id) => {
      try {
        await apiFetch(detail(id), { method: "DELETE" });
      } catch (error) {
        throw toError(error, "No se pudo borrar.");
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [TRAINING_QUERY_KEY] }),
  });
}

export function useSaveDiscipline() {
  return useSave<TrainingDisciplineWrite>(TRAINING.DISCIPLINES, TRAINING.DISCIPLINE);
}

export function useDeleteDiscipline() {
  return useRemove(TRAINING.DISCIPLINE);
}

export function useSaveExercise() {
  return useSave<TrainingExerciseWrite>(TRAINING.EXERCISES, TRAINING.EXERCISE);
}

export function useDeleteExercise() {
  return useRemove(TRAINING.EXERCISE);
}

export function useSaveTemplate() {
  return useSave<TrainingTemplateWrite>(TRAINING.TEMPLATES, TRAINING.TEMPLATE);
}

export function useDeleteTemplate() {
  return useRemove(TRAINING.TEMPLATE);
}
