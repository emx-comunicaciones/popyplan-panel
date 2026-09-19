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
 * entidad no la verá aquí. Tope de 250 páginas (5000 comunidades, a 20
 * por página) para no recorrer sin fin si algo falla en el filtrado: si
 * al llegar al tope el backend sigue mandando `next`, el hook **avisa**
 * en vez de devolver un listado truncado como si fuera completo (un
 * select de comunidad al que le faltan filas es peor que un error
 * visible: nadie sabría que falta nada).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { COMMUNITIES } from "@/lib/api/endpoints";
import type { EntityCommunityRow, PaginatedCommunityList } from "@/lib/api/types";

export type EntityCommunitiesErrorKind = "demasiadas_paginas" | "desconocido";

/**
 * `kind` es lo único que necesita `components/entidad/ComunidadesPanel.tsx`
 * para traducir (tarea 3 de i18n) — `message` sigue en español tal cual
 * (compatibilidad de los tests, y de los componentes de otras tareas
 * —`ComunicacionesPanel`/`RecursosPanel`/`FamiliasPanel`— que todavía
 * pintan `.message` directamente hasta que su propia tarea los traduzca).
 */
export class EntityCommunitiesError extends Error {
  readonly kind: EntityCommunitiesErrorKind;

  constructor(kind: EntityCommunitiesErrorKind, message: string) {
    super(message);
    this.name = "EntityCommunitiesError";
    this.kind = kind;
  }
}

const MAX_PAGES = 250;

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

  if (next) {
    throw new EntityCommunitiesError(
      "demasiadas_paginas",
      "Hay demasiadas comunidades para cargarlas todas; contacta con Popyplan.",
    );
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
      } catch (error) {
        // El aviso de «demasiadas páginas» ya trae su propio mensaje: solo
        // los fallos de red o del backend caen al genérico.
        if (error instanceof EntityCommunitiesError) throw error;
        throw new EntityCommunitiesError("desconocido", "No se pudieron cargar las comunidades de la entidad.");
      }
    },
    // El listado es **global** y hay que recorrerlo página a página (hasta
    // 250 peticiones en serie) para filtrar por `owner_org` en el cliente,
    // porque el backend no admite ese filtro. Con el `staleTime` por
    // defecto (0), cada montaje de un select de comunidad
    // (`AddPersonDialog`, `PersonasTable`, `ComunicacionesPanel`,
    // `RecursosPanel`, `FamiliasPanel`…) repetía el recorrido entero. El
    // arreglo real es el filtro `owner_org` en el backend, anotado en
    // «Pendientes conocidos» de CLAUDE.md; mientras no llegue, 5 minutos
    // de caché: una comunidad nueva la invalidan sus propias mutaciones.
    staleTime: 5 * 60 * 1000,
  });
}
