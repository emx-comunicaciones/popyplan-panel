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
import { COMMUNITIES } from "@/lib/api/endpoints";
import type { CommunityMember } from "@/lib/api/types";

export class CommunityMemberActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunityMemberActionError";
  }
}

function detailOf(error: ApiError): string | undefined {
  const body = error.body as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : undefined;
}

function toActionError(error: unknown, fallback: string): CommunityMemberActionError {
  if (error instanceof ApiError) {
    return new CommunityMemberActionError(detailOf(error) ?? fallback);
  }
  return new CommunityMemberActionError(fallback);
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
        throw toActionError(error, "No se pudo aprobar la solicitud.");
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
        throw toActionError(error, "No se pudo rechazar la solicitud.");
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
        throw toActionError(error, "No se pudo expulsar a la persona.");
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
        throw toActionError(error, "No se pudo cambiar el rol.");
      }
    },
    onSuccess: (_data, variables) => invalidate(queryClient, variables.communityId),
  });
}
