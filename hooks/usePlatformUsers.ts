"use client";

/**
 * Cuentas del admin de plataforma (bloque 1, 2026-09-26): listado
 * paginado y datos de una cuenta concreta, las dos sobre
 * `GET /api/users/users/` (`users/unified_viewset.py::list_users`,
 * `IsAdminUser`, que hoy solo tiene `superadmin`).
 *
 * **El estado activa/desactivada no viaja en ninguna respuesta**
 * (`MeSerializer` no lleva `is_active`, ver
 * `lib/api/types.ts::PlatformAccount`). Por eso:
 * - el listado solo sabe el estado de sus filas cuando el propio filtro
 *   lo fija (`isActive` `true`/`false`), y lo devuelve en `knownActive`;
 * - la ficha (`usePlatformAccount`) lo averigua con dos búsquedas por
 *   correo — la normal y la misma con `?is_active=false` —: si la cuenta
 *   aparece en la segunda, está desactivada. Las dos recorren páginas
 *   hasta encontrarla (`search` es `icontains`: un correo puede casar con
 *   más de 20 cuentas). Buscar por correo es lo
 *   único que permite el backend: ni el id ni ningún otro campo exacto
 *   están en `filterset_fields`/`search_fields`.
 *
 * `?ordering=-created_at`: el backend no ordena el queryset por sí solo,
 * y sin orden la paginación puede repetir o saltarse filas.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { USERS } from "@/lib/api/endpoints";
import type { PaginatedPlatformAccountList, PlatformAccount } from "@/lib/api/types";

export type PlatformUsersErrorKind =
  | "sin_acceso"
  | "pagina_inexistente"
  | "demasiadas_coincidencias"
  | "desconocido";

export class PlatformUsersError extends Error {
  readonly kind: PlatformUsersErrorKind;

  constructor(kind: PlatformUsersErrorKind, message: string) {
    super(message);
    this.name = "PlatformUsersError";
    this.kind = kind;
  }
}

function toUsersError(error: unknown): PlatformUsersError {
  if (error instanceof ApiError && error.status === 403) {
    return new PlatformUsersError("sin_acceso", "Solo el personal de plataforma ve las cuentas.");
  }
  if (error instanceof ApiError && error.status === 404) {
    return new PlatformUsersError("pagina_inexistente", "Esa página del listado ya no existe.");
  }
  return new PlatformUsersError("desconocido", "No se pudieron cargar las cuentas.");
}

export interface PlatformUsersFilters {
  search?: string;
  /** `true`/`false` filtra por `is_active`; `undefined`, todas. */
  isActive?: boolean;
  isVerified?: boolean;
  page?: number;
}

export interface PlatformUsersPage extends PaginatedPlatformAccountList {
  /** Estado de todas las filas si el filtro lo fija; `null` si no se sabe. */
  knownActive: boolean | null;
}

export const PLATFORM_USERS_KEY = "panel-platform-users";
export const PLATFORM_ACCOUNT_KEY = "panel-platform-account";

function usersQuery(params: Record<string, string>): string {
  const query = new URLSearchParams({ ordering: "-created_at", ...params });
  return `${USERS.SEARCH()}?${query.toString()}`;
}

export function usePlatformUsers(
  filters: PlatformUsersFilters,
): UseQueryResult<PlatformUsersPage, PlatformUsersError> {
  const search = filters.search?.trim() ?? "";
  const page = filters.page ?? 1;

  return useQuery<PlatformUsersPage, PlatformUsersError>({
    queryKey: [PLATFORM_USERS_KEY, search, filters.isActive ?? null, filters.isVerified ?? null, page],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page) };
      if (search) params.search = search;
      if (filters.isActive !== undefined) params.is_active = String(filters.isActive);
      if (filters.isVerified !== undefined) params.is_verified = String(filters.isVerified);
      try {
        const data = await apiFetch<PaginatedPlatformAccountList>(usersQuery(params));
        return { ...data, knownActive: filters.isActive ?? null };
      } catch (error) {
        throw toUsersError(error);
      }
    },
  });
}

/**
 * Tope de páginas por búsqueda en `usePlatformAccount` (× PAGE_SIZE 20 del
 * backend = 1000 coincidencias). Un correo completo casa con muy pocas
 * cuentas; si aun así se agota, se lanza en vez de responder «no
 * encontrada» con un recorrido a medias (mismo criterio que
 * `useEntityCommunities`).
 */
export const ACCOUNT_SEARCH_MAX_PAGES = 50;

/**
 * Recorre las páginas de una búsqueda hasta dar con `userId` o agotarlas.
 * `search` es un `icontains`, así que un correo exacto también casa con
 * los que lo contienen (`ana@x.com` ⊂ `mariana@x.com`) y la cuenta puede
 * no estar en la primera página.
 */
async function findAccountAcrossPages(
  params: Record<string, string>,
  userId: string,
): Promise<PlatformAccount | null> {
  for (let page = 1; page <= ACCOUNT_SEARCH_MAX_PAGES; page += 1) {
    const data = await apiFetch<PaginatedPlatformAccountList>(
      usersQuery(page === 1 ? params : { ...params, page: String(page) }),
    );
    const found = data.results.find((row) => String(row.id) === String(userId));
    if (found) return found;
    if (!data.next) return null;
  }
  throw new PlatformUsersError(
    "demasiadas_coincidencias",
    "Hay demasiadas cuentas que coinciden con ese correo para localizar esta.",
  );
}

export interface PlatformAccountState {
  /** `null` si ninguna cuenta con ese correo tiene ese id. */
  account: PlatformAccount | null;
  isActive: boolean;
}

/**
 * Datos de cuenta de `userId`, localizada por su correo (el listado la
 * enlaza con `?email=`). `enabled` solo con correo: sin él no hay forma
 * de pedirla (ver la cabecera de este módulo).
 */
export function usePlatformAccount(
  userId: string,
  email: string | null,
): UseQueryResult<PlatformAccountState, PlatformUsersError> {
  const trimmed = email?.trim() ?? "";

  return useQuery<PlatformAccountState, PlatformUsersError>({
    queryKey: [PLATFORM_ACCOUNT_KEY, String(userId), trimmed],
    queryFn: async () => {
      try {
        const [account, inactive] = await Promise.all([
          findAccountAcrossPages({ search: trimmed }, userId),
          findAccountAcrossPages({ search: trimmed, is_active: "false" }, userId),
        ]);
        return { account, isActive: inactive === null };
      } catch (error) {
        if (error instanceof PlatformUsersError) throw error;
        throw toUsersError(error);
      }
    },
    enabled: trimmed.length > 0,
  });
}
