"use client";

/**
 * `GET /api/organizations/{org_id}/resources/` (`docs/PANEL.md` §7):
 * biblioteca de recursos de la entidad, ya filtrada por el backend según
 * la visibilidad de quien pregunta (§7.2: `public` para cualquiera,
 * `members` además para quien tiene alta activa, `families` invisible
 * salvo para quien modera — marcador de posición hasta P6); quien tiene
 * `moderar` (titular/moderador) ve todos, sea cual sea su `audience`, para
 * poder gestionarlos. Array plano, ordenado por `is_featured` descendente
 * y luego `created_at` descendente (destacados primero).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { EntityResource } from "@/lib/api/types";

export class ResourcesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourcesError";
  }
}

export function useResources(
  orgId: number | string,
): UseQueryResult<EntityResource[], ResourcesError> {
  return useQuery<EntityResource[], ResourcesError>({
    queryKey: ["panel-resources", orgId],
    queryFn: async () => {
      try {
        return await apiFetch<EntityResource[]>(ORGANIZATIONS.RESOURCES(orgId));
      } catch {
        throw new ResourcesError("No se pudieron cargar los recursos.");
      }
    },
  });
}
