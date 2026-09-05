"use client";

/**
 * `GET /api/communities/{id}/members/` y `.../pending-requests/`
 * (API de comunidades, reutilizada por el panel — ver
 * `hooks/useEntityCommunities.ts`). Ambas devuelven un array plano de
 * `CommunityMember`, no `Community` como dice (mal) `docs/schema.yaml`.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { COMMUNITIES } from "@/lib/api/endpoints";
import type { CommunityMember } from "@/lib/api/types";

export class CommunityMembersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunityMembersError";
  }
}

export function useCommunityMembers(
  communityId: string | null,
): UseQueryResult<CommunityMember[], CommunityMembersError> {
  return useQuery<CommunityMember[], CommunityMembersError>({
    queryKey: ["panel-community-members", communityId],
    queryFn: async () => {
      try {
        return await apiFetch<CommunityMember[]>(COMMUNITIES.MEMBERS(communityId as string));
      } catch {
        throw new CommunityMembersError("No se pudieron cargar los miembros de la comunidad.");
      }
    },
    enabled: Boolean(communityId),
  });
}

export function useCommunityPendingRequests(
  communityId: string | null,
): UseQueryResult<CommunityMember[], CommunityMembersError> {
  return useQuery<CommunityMember[], CommunityMembersError>({
    queryKey: ["panel-community-pending-requests", communityId],
    queryFn: async () => {
      try {
        return await apiFetch<CommunityMember[]>(COMMUNITIES.PENDING_REQUESTS(communityId as string));
      } catch {
        throw new CommunityMembersError("No se pudieron cargar las solicitudes pendientes.");
      }
    },
    enabled: Boolean(communityId),
  });
}
