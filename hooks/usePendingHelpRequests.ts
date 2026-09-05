"use client";

/**
 * `GET /api/safety/help-requests/pending/?organization=<id>`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §5): avisos de «hoy lo llevo mal»
 * pendientes de la entidad. Solo la guardia asignada (`Organization.
 * on_call_user`) o `titular`/`moderador` si no hay guardia — el 403 se
 * traduce a `sin_acceso` para que la página pinte «Sin acceso» en vez de
 * un error genérico. Sin paginar de verdad (ver
 * `lib/api/types.ts::HelpRequestRow`).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { HelpRequestRow } from "@/lib/api/types";

export type PendingHelpRequestsErrorKind = "sin_acceso" | "desconocido";

export class PendingHelpRequestsError extends Error {
  readonly kind: PendingHelpRequestsErrorKind;

  constructor(kind: PendingHelpRequestsErrorKind, message: string) {
    super(message);
    this.name = "PendingHelpRequestsError";
    this.kind = kind;
  }
}

export function usePendingHelpRequests(
  orgId: number | string,
): UseQueryResult<HelpRequestRow[], PendingHelpRequestsError> {
  return useQuery<HelpRequestRow[], PendingHelpRequestsError>({
    queryKey: ["panel-help-requests-pending", orgId],
    queryFn: async () => {
      try {
        return await apiFetch<HelpRequestRow[]>(
          `${SAFETY.HELP_REQUESTS_PENDING()}?organization=${orgId}`,
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new PendingHelpRequestsError(
            "sin_acceso",
            "No tienes acceso a los avisos de ayuda.",
          );
        }
        throw new PendingHelpRequestsError("desconocido", "No se pudieron cargar los avisos de ayuda.");
      }
    },
  });
}
