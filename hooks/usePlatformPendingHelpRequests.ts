"use client";

/**
 * Avisos de «hoy lo llevo mal» pendientes de **todas** las entidades,
 * para «Ayuda» de plataforma. Carry-over de la tarea W5 cerrado en W6:
 * `GET /api/safety/help-requests/pending/` sin `?organization=` agrega
 * ahora, para `superadmin`/`moderator`/`support`
 * (`safety/viewsets.py::HelpRequestViewSet.pending`, `docs/PANEL.md`
 * §10.1, tarea backend P7), los avisos pendientes de todas las entidades
 * a la vez con la misma forma de fila (`HelpRequestSerializer`, incluido
 * `organization_display`) — sin paginar, igual que la variante con
 * `?organization=`. Antes de P7 esta ruta no existía y el hook recorría
 * todas las entidades tolerando 403 por cada una; con el agregado del
 * backend ya no hace falta: una sola petición.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { HelpRequestRow } from "@/lib/api/types";

export class PlatformHelpRequestsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformHelpRequestsError";
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
        const rows = await apiFetch<HelpRequestRow[]>(SAFETY.HELP_REQUESTS_PENDING());
        return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      } catch {
        throw new PlatformHelpRequestsError("No se pudieron cargar los avisos de ayuda.");
      }
    },
  });
}
