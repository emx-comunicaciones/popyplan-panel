"use client";

/**
 * `GET`/`POST`/`DELETE /api/organizations/{id}/members/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §8): equipo de la entidad, solo
 * `titular` (permiso `equipo`). Sin paginar de verdad (ver
 * `lib/api/types.ts::OrgMembershipFull`). Desde la tarea backend P7,
 * `OrgMembership` lleva `public_name`/`photo` (solo lectura) de `user`
 * (`docs/PANEL.md` §10.3, carry-over cerrado en la tarea W6): la tabla
 * del equipo y los selects de referente pintan el nombre, nunca el id.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { OrgMembershipFull, OrgMembershipRole } from "@/lib/api/types";

export type OrgMembersErrorKind = "invalido" | "sin_acceso" | "desconocido";

export class OrgMembersError extends Error {
  readonly kind: OrgMembersErrorKind;
  readonly detail?: string;

  constructor(kind: OrgMembersErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "OrgMembersError";
    this.kind = kind;
    this.detail = detail;
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
          throw new OrgMembersError("sin_acceso", "Solo el titular puede ver el equipo de la entidad.");
        }
        throw new OrgMembersError("desconocido", "No se pudo cargar el equipo de la entidad.");
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

/**
 * Quien deja el equipo deja de poder ser referente y cambia su rol en la
 * entidad: el listado de personas y las fichas lo pintan, y sus claves
 * llevan filtros/periodo, así que se invalidan por prefijo.
 */
function invalidatePeople(queryClient: ReturnType<typeof useQueryClient>, orgId: number | string): void {
  queryClient.invalidateQueries({ queryKey: ["panel-people", orgId] });
  queryClient.invalidateQueries({ queryKey: ["panel-person", orgId] });
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
          const detail = detailOf(error);
          throw new OrgMembersError(
            "invalido",
            detail ?? "Esa persona ya tiene un rol en esta entidad, o el rol no es válido.",
            detail,
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new OrgMembersError("sin_acceso", "Solo el titular puede dar de alta al equipo.");
        }
        throw new OrgMembersError("desconocido", "No se pudo dar de alta a la persona.");
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
        // `detailOf` (`lib/api/drfError.ts`) primero: el backend explica
        // por qué no se puede (p. ej. dejar la entidad sin titular) mejor
        // que el genérico de aquí.
        if (error instanceof ApiError && error.status === 403) {
          const detail = detailOf(error);
          throw new OrgMembersError(
            "sin_acceso",
            detail ?? "Solo el titular puede quitar del equipo.",
            detail,
          );
        }
        if (error instanceof ApiError && (error.status === 400 || error.status === 409)) {
          const detail = detailOf(error);
          throw new OrgMembersError(
            "invalido",
            detail ?? "No se pudo quitar a la persona del equipo.",
            detail,
          );
        }
        throw new OrgMembersError("desconocido", "No se pudo quitar a la persona del equipo.");
      }
    },
    onSuccess: () => {
      invalidateMembers(queryClient, orgId);
      invalidatePeople(queryClient, orgId);
    },
  });
}
