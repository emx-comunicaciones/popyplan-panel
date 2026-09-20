"use client";

/**
 * `GET /api/communities/?owner_org=<id>&page=` (API general de
 * comunidades — el panel de entidad la reutiliza, no hay una ruta propia
 * de `panel` para esto).
 *
 * **Hallazgo B-C1 de la auditoría de integración (2026-09-21), ya
 * corregido aquí**: hasta esta tarea el hook recorría el listado
 * **global** página a página (hasta 250 peticiones en serie) y filtraba
 * en el cliente por `owner.type === 'organization' && owner.id ===
 * orgId`, porque su docstring daba por hecho que el backend no admitía
 * filtrar por entidad. Sí lo admite (`communities/unified_viewset.py
 * ::get_queryset`, carry-over P6): `?owner_org=` filtra **y** activa el
 * modo privilegiado —quien tiene `moderar` en esa entidad
 * (titular/moderador) ve TODAS sus comunidades, incluidas las `private`
 * de las que no es miembro y las de los dos espacios de POP Familias—.
 * El recorrido global, además de caro, escondía justo esas: la entidad de
 * demo veía 1 de sus 5 comunidades. Solo está sin declarar en
 * `docs/schema.yaml` (el `list` no tiene `@extend_schema(parameters=…)`),
 * por eso `npm run gen:types` nunca lo sacó; el lote 2 del backend lo
 * documenta.
 *
 * La respuesta sigue paginada (`PageNumberPagination` estándar), así que
 * el hook concatena las páginas de esa entidad — hoy una sola salvo
 * entidades con más de 20 comunidades. El tope de 250 páginas se
 * mantiene como red de seguridad: si al llegar a él el backend sigue
 * mandando `next`, el hook **avisa** en vez de devolver un listado
 * truncado como si fuera completo (un select de comunidad al que le
 * faltan filas es peor que un error visible: nadie sabría que falta
 * nada).
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

async function fetchAllPages(orgId: number | string): Promise<EntityCommunityRow[]> {
  const rows: EntityCommunityRow[] = [];
  let page = 1;
  let next: string | null = COMMUNITIES.LIST();

  while (next && page <= MAX_PAGES) {
    const data: PaginatedCommunityList = await apiFetch<PaginatedCommunityList>(
      `${COMMUNITIES.LIST()}?owner_org=${encodeURIComponent(String(orgId))}&page=${page}`,
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
        return await fetchAllPages(orgId);
      } catch (error) {
        // El aviso de «demasiadas páginas» ya trae su propio mensaje: solo
        // los fallos de red o del backend caen al genérico.
        if (error instanceof EntityCommunitiesError) throw error;
        throw new EntityCommunitiesError("desconocido", "No se pudieron cargar las comunidades de la entidad.");
      }
    },
    // Sin `staleTime`: con `?owner_org=` esto es una petición, no un
    // recorrido de hasta 250 páginas en serie, así que ya no hace falta
    // la caché de 5 minutos que tapaba ese coste (y que dejaba stale los
    // badges de `members_count` tras aprobar o expulsar a alguien).
  });
}
