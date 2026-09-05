"use client";

/**
 * `GET`/`POST /api/safety/platform-roles/` y
 * `DELETE /api/safety/platform-roles/{user_id}/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §1): roles de plataforma, solo
 * `superadmin`. Sin paginar de verdad («lista sin paginar de roles
 * vigentes», contrato explícito).
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { PlatformRole, PlatformRoleGrantRequest } from "@/lib/api/types";

export class PlatformRolesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformRolesError";
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
          throw new PlatformRolesError("Solo superadmin ve los roles de plataforma.");
        }
        throw new PlatformRolesError("No se pudieron cargar los roles de plataforma.");
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
          const body = error.body as { detail?: unknown } | null;
          throw new PlatformRolesError(
            typeof body?.detail === "string" ? body.detail : "Revisa el id de usuario y el rol.",
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new PlatformRolesError("Solo superadmin concede roles de plataforma.");
        }
        throw new PlatformRolesError("No se pudo conceder el rol.");
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
          throw new PlatformRolesError("Solo superadmin revoca roles de plataforma.");
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new PlatformRolesError("Esa persona no tiene un rol de plataforma vigente.");
        }
        throw new PlatformRolesError("No se pudo revocar el rol.");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
