"use client";

/**
 * `GET /api/users/users/?search=` (`users/unified_viewset.py::list_users`):
 * busca cuentas por email/username para «Conceder rol» de
 * `roles/page.tsx`, y para elegir cuenta en Bloqueos y Notificaciones. `IsAdminUser` (`is_staff`): solo `superadmin` lo
 * tiene hoy (`docs/SEGURIDAD_Y_MODERACION.md` §1) y solo `superadmin`
 * llega a esta página, así que en la práctica siempre funciona para
 * quien la usa — pero por si acaso un 403 no rompe el formulario: se
 * traduce a una lista vacía (`enabled` solo con al menos dos
 * caracteres, para no disparar una búsqueda por cada tecla de una sola
 * letra).
 *
 * **Solo el 403 cae a lista vacía.** Cualquier otro error de la API se
 * lanza como `UserSearchError` (`kind: "desconocido"`) para que quien lo
 * usa diga que la búsqueda falló: tragárselo dejaba el desplegable vacío,
 * indistinguible de «ninguna cuenta coincide». Un error que no es de la
 * API se relanza tal cual.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { USERS } from "@/lib/api/endpoints";
import type { PaginatedPlatformUserSearchList, PlatformUserSearchRow } from "@/lib/api/types";

export type UserSearchErrorKind = "desconocido";

export class UserSearchError extends Error {
  readonly kind: UserSearchErrorKind;

  constructor(kind: UserSearchErrorKind, message: string) {
    super(message);
    this.name = "UserSearchError";
    this.kind = kind;
  }
}

export function useUserSearch(search: string): UseQueryResult<PlatformUserSearchRow[], Error> {
  const trimmed = search.trim();

  return useQuery<PlatformUserSearchRow[], Error>({
    queryKey: ["panel-user-search", trimmed],
    queryFn: async () => {
      try {
        const data = await apiFetch<PaginatedPlatformUserSearchList>(
          `${USERS.SEARCH()}?search=${encodeURIComponent(trimmed)}`,
        );
        return data.results;
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return [];
        if (error instanceof ApiError) {
          throw new UserSearchError("desconocido", "No se pudo buscar cuentas.");
        }
        throw error;
      }
    },
    enabled: trimmed.length >= 2,
  });
}
