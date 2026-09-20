"use client";

/**
 * `GET /api/communities/{id}/` (`CommunitySerializer`): ficha completa
 * de una comunidad. Único consumidor hoy:
 * `components/entidad/EditarComunidadDialog.tsx`, que necesita
 * `code_of_conduct` — el campo que `EntityCommunityRow`
 * (`CommunityList`, el listado de `useEntityCommunities`) no trae. El
 * resto de campos del formulario de edición (`name`/`description`/
 * `visibility`) ya llegan con la fila seleccionada, así que este hook
 * solo se pide mientras el diálogo de edición está abierto (`enabled`),
 * mismo patrón que `hooks/usePersonSupport.ts` para no disparar una
 * petición que nadie va a mostrar todavía.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { COMMUNITIES } from "@/lib/api/endpoints";
import type { CommunityDetail } from "@/lib/api/types";

export class CommunityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunityError";
  }
}

export function useCommunity(
  communityId: string,
  options: { enabled?: boolean } = {},
): UseQueryResult<CommunityDetail, CommunityError> {
  return useQuery<CommunityDetail, CommunityError>({
    queryKey: ["panel-community", communityId],
    queryFn: async () => {
      try {
        return await apiFetch<CommunityDetail>(COMMUNITIES.DETAIL(communityId));
      } catch {
        throw new CommunityError("No se pudo cargar la ficha de la comunidad.");
      }
    },
    enabled: options.enabled ?? true,
  });
}
