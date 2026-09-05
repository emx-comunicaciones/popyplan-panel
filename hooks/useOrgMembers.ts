"use client";

/**
 * `GET`/`POST`/`DELETE /api/organizations/{id}/members/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §8): equipo de la entidad, solo
 * `titular` (permiso `equipo`). Sin paginar de verdad (ver
 * `lib/api/types.ts::OrgMembershipFull`). `OrgMembership` no trae nombre
 * ni email de la persona (invariante 1/9): la tabla del equipo solo puede
 * mostrar el id de usuario — ver «Desviaciones» del informe.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { OrgMembershipFull, OrgMembershipRole } from "@/lib/api/types";

export class OrgMembersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrgMembersError";
  }
}

export function useOrgMembers(
  orgId: number | string,
): UseQueryResult<OrgMembershipFull[], OrgMembersError> {
  return useQuery<OrgMembershipFull[], OrgMembersError>({
    queryKey: ["panel-org-members", orgId],
    queryFn: async () => {
      try {
        return await apiFetch<OrgMembershipFull[]>(ORGANIZATIONS.MEMBERS(orgId));
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new OrgMembersError("Solo el titular puede ver el equipo de la entidad.");
        }
        throw new OrgMembersError("No se pudo cargar el equipo de la entidad.");
      }
    },
  });
}

export interface AddOrgMemberInput {
  user: number;
  role: OrgMembershipRole;
}

function invalidateMembers(queryClient: ReturnType<typeof useQueryClient>, orgId: number | string): void {
  queryClient.invalidateQueries({ queryKey: ["panel-org-members", orgId] });
}

export function useAddOrgMember(
  orgId: number | string,
): UseMutationResult<OrgMembershipFull, OrgMembersError, AddOrgMemberInput> {
  const queryClient = useQueryClient();

  return useMutation<OrgMembershipFull, OrgMembersError, AddOrgMemberInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<OrgMembershipFull>(ORGANIZATIONS.MEMBERS(orgId), {
          method: "POST",
          body: input,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const body = error.body as { detail?: unknown } | null;
          throw new OrgMembersError(
            typeof body?.detail === "string"
              ? body.detail
              : "Esa persona ya tiene un rol en esta entidad, o el rol no es válido.",
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new OrgMembersError("Solo el titular puede dar de alta al equipo.");
        }
        throw new OrgMembersError("No se pudo dar de alta a la persona.");
      }
    },
    onSuccess: () => invalidateMembers(queryClient, orgId),
  });
}

export function useRemoveOrgMember(
  orgId: number | string,
): UseMutationResult<void, OrgMembersError, number> {
  const queryClient = useQueryClient();

  return useMutation<void, OrgMembersError, number>({
    mutationFn: async (userId) => {
      try {
        await apiFetch<void>(`${ORGANIZATIONS.MEMBERS(orgId)}?user_id=${userId}`, {
          method: "DELETE",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new OrgMembersError("Solo el titular puede quitar del equipo.");
        }
        throw new OrgMembersError("No se pudo quitar a la persona del equipo.");
      }
    },
    onSuccess: () => invalidateMembers(queryClient, orgId),
  });
}
