"use client";

/**
 * `GET /api/communities/?page=` (`docs/schema.yaml`, API general de
 * comunidades — el panel de entidad la reutiliza, no hay una ruta propia
 * de `panel` para esto). **Hueco documentado** (ver informe de la tarea
 * W4a): el backend no admite filtrar por `owner_org`, así que este hook
 * recorre todas las páginas visibles para quien mira y filtra en el
 * cliente por `owner.type === 'organization' && owner.id === orgId`.
 * Además, `communities/services/visibility.py::_visibles_para` excluye
 * las comunidades `private` de quien no es ya miembro — un `titular` que
 * no esté personalmente dentro de una comunidad privada de su propia
 * entidad no la verá aquí. Tope de 20 páginas (2000 comunidades) para no
 * recorrer sin fin si algo falla en el filtrado.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { COMMUNITIES } from "@/lib/api/endpoints";
import type { EntityCommunityRow, PaginatedCommunityList } from "@/lib/api/types";

export class EntityCommunitiesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityCommunitiesError";
  }
}

const MAX_PAGES = 20;

async function fetchAllPages(): Promise<EntityCommunityRow[]> {
  const rows: EntityCommunityRow[] = [];
  let page = 1;
  let next: string | null = COMMUNITIES.LIST();

  while (next && page <= MAX_PAGES) {
    const data: PaginatedCommunityList = await apiFetch<PaginatedCommunityList>(
      `${COMMUNITIES.LIST()}?page=${page}`,
    );
    rows.push(...data.results);
    next = data.next;
    page += 1;
  }

  return rows;
}

export function useEntityCommunities(
  orgId: number | string,
): UseQueryResult<EntityCommunityRow[], EntityCommunitiesError> {
  return useQuery<EntityCommunityRow[], EntityCommunitiesError>({
    queryKey: ["panel-entity-communities", orgId],
    queryFn: async () => {
      try {
        const all = await fetchAllPages();
        return all.filter(
          (community) => community.owner.type === "organization" && String(community.owner.id) === String(orgId),
        );
      } catch {
        throw new EntityCommunitiesError("No se pudieron cargar las comunidades de la entidad.");
      }
    },
  });
}
