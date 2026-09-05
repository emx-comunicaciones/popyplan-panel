"use client";

/**
 * `GET /api/organizations/{org_id}/invitations/` (`docs/PANEL.md` §3b.1,
 * tarea W3b): todas las invitaciones de la entidad; `?status=` filtra por
 * `pending`/`accepted`/`expired`/`revoked`. Mismo permiso que crear
 * (`equipo` o `moderar`, es decir titular/moderador). Las filas
 * «Invitada (pendiente)» que ve la tabla de Personas llegan mezcladas en
 * `usePeople` (`include_invited=true`, §3b.7) para no tener dos fuentes
 * de verdad para el mismo dato: este hook se usa solo para el recuento de
 * pendientes que se muestra junto al checkbox «Incluir invitadas»
 * (`components/entidad/PersonasTable.tsx`).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { EntityInvitation, EntityInvitationStatus } from "@/lib/api/types";

export class InvitationsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationsError";
  }
}

export function useInvitations(
  orgId: number | string,
  status?: EntityInvitationStatus,
): UseQueryResult<EntityInvitation[], InvitationsError> {
  return useQuery<EntityInvitation[], InvitationsError>({
    queryKey: ["panel-invitations", orgId, status ?? "all"],
    queryFn: async () => {
      try {
        const query = status ? `?status=${status}` : "";
        return await apiFetch<EntityInvitation[]>(`${ORGANIZATIONS.INVITATIONS(orgId)}${query}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new InvitationsError("No tienes permiso para ver las invitaciones.");
        }
        throw new InvitationsError("No se pudieron cargar las invitaciones.");
      }
    },
  });
}
