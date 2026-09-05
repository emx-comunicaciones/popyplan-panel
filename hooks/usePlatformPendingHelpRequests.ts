"use client";

/**
 * Avisos de «hoy lo llevo mal» pendientes de **todas** las entidades,
 * para «Ayuda» de plataforma (tarea W5). `docs/SEGURIDAD_Y_MODERACION.md`
 * §5 no documenta una variante global de
 * `GET /api/safety/help-requests/pending/`: solo admite `?organization=<id>`
 * y solo autoriza a la guardia de esa entidad o a su `titular`/`moderador`
 * (`safety/viewsets.py::HelpRequestViewSet.pending`) — **ningún** rol de
 * plataforma (`superadmin`, `moderator`, `verifier`, `support`) pasa esa
 * comprobación por sí solo, a menos que además tenga una `OrgMembership`
 * en esa entidad. Es un hueco de contrato documentado en el informe de
 * esta tarea (pregunta de diseño): mientras no exista una ruta agregada,
 * este hook recorre las entidades (`useOrganizations`, todas las páginas)
 * y pide `pending` de cada una, tolerando 403/400 por entidad (se omite
 * esa entidad del resultado, no rompe la página entera) — en la práctica
 * casi todas las llamadas devolverán 403 para quien solo tiene rol de
 * plataforma, y la lista quedará vacía salvo que esa persona además sea
 * guardia o titular/moderador de alguna entidad.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { ORGANIZATIONS, SAFETY } from "@/lib/api/endpoints";
import type { HelpRequestRow, PaginatedOrganizationList } from "@/lib/api/types";

export class PlatformHelpRequestsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformHelpRequestsError";
  }
}

const MAX_ORG_PAGES = 20;

async function fetchAllOrgIds(): Promise<number[]> {
  const ids: number[] = [];
  let page = 1;
  let next: string | null = ORGANIZATIONS.LIST();

  while (next && page <= MAX_ORG_PAGES) {
    const data = await apiFetch<PaginatedOrganizationList>(`${ORGANIZATIONS.LIST()}?page=${page}`);
    ids.push(...(data.results ?? []).map((org) => org.id));
    next = data.next ?? null;
    page += 1;
  }

  return ids;
}

async function fetchPendingFor(orgId: number): Promise<HelpRequestRow[]> {
  try {
    return await apiFetch<HelpRequestRow[]>(
      `${SAFETY.HELP_REQUESTS_PENDING()}?organization=${orgId}`,
    );
  } catch {
    // 403 (sin guardia/titular/moderador en esa entidad) o 400: se omite
    // esa entidad, no es un error de la página completa.
    return [];
  }
}

export function usePlatformPendingHelpRequests(): UseQueryResult<
  HelpRequestRow[],
  PlatformHelpRequestsError
> {
  return useQuery<HelpRequestRow[], PlatformHelpRequestsError>({
    queryKey: ["panel-platform-help-requests-pending"],
    queryFn: async () => {
      try {
        const orgIds = await fetchAllOrgIds();
        const perOrg = await Promise.all(orgIds.map(fetchPendingFor));
        return perOrg
          .flat()
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      } catch {
        throw new PlatformHelpRequestsError("No se pudieron cargar los avisos de ayuda.");
      }
    },
  });
}
