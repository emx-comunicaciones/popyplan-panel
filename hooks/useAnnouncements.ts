"use client";

/**
 * `GET /api/panel/entidad/{org_id}/announcements/` (`docs/PANEL.md` §5):
 * historial de comunicaciones oficiales de la entidad, array plano (sin
 * paginar, verificado contra `panel/viewsets.py`). Visible para cualquier
 * rol con `ver_panel` (titular, moderador, dinamizador, analista,
 * referente); solo titular/moderador pueden componer una nueva (ver
 * `useSendAnnouncement.ts`).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { PANEL } from "@/lib/api/endpoints";
import type { Announcement } from "@/lib/api/types";

export class AnnouncementsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnouncementsError";
  }
}

export function useAnnouncements(
  orgId: number | string,
): UseQueryResult<Announcement[], AnnouncementsError> {
  return useQuery<Announcement[], AnnouncementsError>({
    queryKey: ["panel-announcements", orgId],
    queryFn: async () => {
      try {
        return await apiFetch<Announcement[]>(PANEL.ANNOUNCEMENTS(orgId));
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new AnnouncementsError("No tienes acceso a las comunicaciones de esta entidad.");
        }
        throw new AnnouncementsError("No se pudieron cargar las comunicaciones.");
      }
    },
  });
}
