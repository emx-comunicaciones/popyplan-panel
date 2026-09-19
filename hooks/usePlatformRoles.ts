"use client";

/**
 * `GET`/`POST /api/safety/platform-roles/` y
 * `DELETE /api/safety/platform-roles/{user_id}/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §1): roles de plataforma, solo
 * `superadmin`. Sin paginar de verdad («lista sin paginar de roles
 * vigentes», contrato explícito).
 *
 * **i18n (tarea 5 del plan de i18n):** `PlatformRolesError` es una
 * única clase para las tres operaciones (lectura/conceder/revocar), con
 * un `kind` que cubre la unión de los tres — cada una solo lanza el
 * subconjunto que le aplica (mismo patrón que otras clases de error
 * compartidas del panel, p. ej. `ProgramMutationError`); `RolesPanel.tsx`
 * traduce con `errorKindText` y un mapa de claves por operación. El 400
 * de conceder (`{"user": [...]}`/`{"role": [...]}`) conserva el `detail`
 * literal del backend cuando lo hay.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { SAFETY } from "@/lib/api/endpoints";
import type { PlatformRole, PlatformRoleGrantRequest } from "@/lib/api/types";

export type PlatformRolesErrorKind =
  | "sin_acceso"
  | "invalido"
  | "sin_permiso"
  | "no_encontrado"
  | "desconocido";

export class PlatformRolesError extends Error {
  readonly kind: PlatformRolesErrorKind;
  /** Texto verbatim del backend, solo cuando `detailOf` encuentra algo (400 de conceder). */
  readonly detail?: string;

  constructor(kind: PlatformRolesErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "PlatformRolesError";
    this.kind = kind;
    this.detail = detail;
  }
}

const QUERY_KEY = ["panel-platform-roles"];

export function usePlatformRoles(): UseQueryResult<PlatformRole[], PlatformRolesError> {
  return useQuery<PlatformRole[], PlatformRolesError>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      try {
        return await apiFetch<PlatformRole[]>(SAFETY.PLATFORM_ROLES());
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new PlatformRolesError("sin_acceso", "Solo superadmin ve los roles de plataforma.");
        }
        throw new PlatformRolesError("desconocido", "No se pudieron cargar los roles de plataforma.");
      }
    },
  });
}

export function useGrantPlatformRole(): UseMutationResult<
  PlatformRole,
  PlatformRolesError,
  PlatformRoleGrantRequest
> {
  const queryClient = useQueryClient();

  return useMutation<PlatformRole, PlatformRolesError, PlatformRoleGrantRequest>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<PlatformRole>(SAFETY.PLATFORM_ROLES(), { method: "POST", body: input });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new PlatformRolesError("invalido", detail ?? "Revisa el id de usuario y el rol.", detail);
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new PlatformRolesError("sin_permiso", "Solo superadmin concede roles de plataforma.");
        }
        throw new PlatformRolesError("desconocido", "No se pudo conceder el rol.");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useRevokePlatformRole(): UseMutationResult<void, PlatformRolesError, number> {
  const queryClient = useQueryClient();

  return useMutation<void, PlatformRolesError, number>({
    mutationFn: async (userId) => {
      try {
        await apiFetch<void>(SAFETY.PLATFORM_ROLE_DETAIL(userId), { method: "DELETE" });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new PlatformRolesError("sin_permiso", "Solo superadmin revoca roles de plataforma.");
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new PlatformRolesError("no_encontrado", "Esa persona no tiene un rol de plataforma vigente.");
        }
        throw new PlatformRolesError("desconocido", "No se pudo revocar el rol.");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
