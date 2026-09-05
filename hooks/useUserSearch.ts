"use client";

/**
 * `GET /api/users/users/?search=` (`users/unified_viewset.py::list_users`):
 * busca cuentas por email/username para «Conceder rol» de
 * `roles/page.tsx`. `IsAdminUser` (`is_staff`): solo `superadmin` lo
 * tiene hoy (`docs/SEGURIDAD_Y_MODERACION.md` §1) y solo `superadmin`
 * llega a esta página, así que en la práctica siempre funciona para
 * quien la usa — pero por si acaso un 403 no rompe el formulario: se
 * traduce a una lista vacía (`enabled` solo con al menos dos
 * caracteres, para no disparar una búsqueda por cada tecla de una sola
 * letra).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { USERS } from "@/lib/api/endpoints";
import type { PaginatedPlatformUserSearchList, PlatformUserSearchRow } from "@/lib/api/types";

export function useUserSearch(search: string): UseQueryResult<PlatformUserSearchRow[], never> {
  const trimmed = search.trim();

  return useQuery<PlatformUserSearchRow[], never>({
    queryKey: ["panel-user-search", trimmed],
    queryFn: async () => {
      try {
        const data = await apiFetch<PaginatedPlatformUserSearchList>(
          `${USERS.SEARCH()}?search=${encodeURIComponent(trimmed)}`,
        );
        return data.results;
      } catch (error) {
        if (error instanceof ApiError) return [];
        throw error;
      }
    },
    enabled: trimmed.length >= 2,
  });
}
