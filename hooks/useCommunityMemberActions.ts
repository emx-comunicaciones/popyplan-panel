"use client";

/**
 * Acciones de gestión de una comunidad (`communities/unified_viewset.py`,
 * reutilizadas por el panel de entidad): aprobar/rechazar solicitud,
 * cambiar rol y expulsar. Todas exigen `community.can_manage(user)`
 * (titular/moderador de la entidad propietaria, o moderador de la propia
 * comunidad) y devuelven 403 si no. Invalidan miembros y pendientes tras
 * tener éxito.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { COMMUNITIES } from "@/lib/api/endpoints";
import type { CommunityMember } from "@/lib/api/types";

export type CommunityMemberActionKind = "approve" | "reject" | "kick" | "changeRole";

/**
 * `kind` (+ `detail`, el texto verbatim del backend cuando lo hay) es lo
 * que traduce `components/entidad/ComunidadesPanel.tsx` (tarea 3 de i18n,
 * `lib/i18n/errorKindText.ts`) — este hook, plano `.ts`, no puede llamar
 * a `t()`, así que `message` sigue en español tal cual (compatibilidad de
 * los tests que ya lo comprueban).
 */
export class CommunityMemberActionError extends Error {
  readonly kind: CommunityMemberActionKind;
  readonly detail?: string;

  constructor(kind: CommunityMemberActionKind, message: string, detail?: string) {
    super(message);
    this.name = "CommunityMemberActionError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toActionError(
  kind: CommunityMemberActionKind,
  error: unknown,
  fallback: string,
): CommunityMemberActionError {
  if (error instanceof ApiError) {
    const detail = detailOf(error);
    return new CommunityMemberActionError(kind, detail ?? fallback, detail);
  }
  return new CommunityMemberActionError(kind, fallback);
}

function invalidate(
  queryClient: ReturnType<typeof useQueryClient>,
  communityId: string,
): void {
  queryClient.invalidateQueries({ queryKey: ["panel-community-members", communityId] });
  queryClient.invalidateQueries({ queryKey: ["panel-community-pending-requests", communityId] });
}

export interface CommunityMemberActionInput {
  communityId: string;
  memberId: string;
}

export function useApproveCommunityMember(): UseMutationResult<
  CommunityMember,
  CommunityMemberActionError,
  CommunityMemberActionInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, memberId }) => {
      try {
        return await apiFetch<CommunityMember>(COMMUNITIES.APPROVE_MEMBER(communityId, memberId), {
          method: "POST",
        });
      } catch (error) {
        throw toActionError("approve", error, "No se pudo aprobar la solicitud.");
      }
    },
    onSuccess: (_data, variables) => invalidate(queryClient, variables.communityId),
  });
}

export function useRejectCommunityMember(): UseMutationResult<
  void,
  CommunityMemberActionError,
  CommunityMemberActionInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, memberId }) => {
      try {
        await apiFetch<void>(COMMUNITIES.REJECT_MEMBER(communityId, memberId), { method: "POST" });
      } catch (error) {
        throw toActionError("reject", error, "No se pudo rechazar la solicitud.");
      }
    },
    onSuccess: (_data, variables) => invalidate(queryClient, variables.communityId),
  });
}

export function useKickCommunityMember(): UseMutationResult<
  void,
  CommunityMemberActionError,
  CommunityMemberActionInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, memberId }) => {
      try {
        await apiFetch<void>(COMMUNITIES.KICK_MEMBER(communityId, memberId), { method: "POST" });
      } catch (error) {
        throw toActionError("kick", error, "No se pudo expulsar a la persona.");
      }
    },
    onSuccess: (_data, variables) => invalidate(queryClient, variables.communityId),
  });
}

export interface ChangeCommunityMemberRoleInput extends CommunityMemberActionInput {
  role: "moderator" | "member";
}

export function useChangeCommunityMemberRole(): UseMutationResult<
  CommunityMember,
  CommunityMemberActionError,
  ChangeCommunityMemberRoleInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, memberId, role }) => {
      try {
        return await apiFetch<CommunityMember>(COMMUNITIES.MEMBER_ROLE(communityId, memberId), {
          method: "PATCH",
          body: { role },
        });
      } catch (error) {
        throw toActionError("changeRole", error, "No se pudo cambiar el rol.");
      }
    },
    onSuccess: (_data, variables) => invalidate(queryClient, variables.communityId),
  });
}
