"use client";

/**
 * `POST /api/safety/help-requests/{id}/acknowledge/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §5): «He contactado». Invalida la
 * lista de pendientes tras marcarlo — y también la de plataforma, porque
 * el hook global (`useAcknowledgeHelpRequestGlobal`) hace POST al mismo
 * endpoint y quien tiene rol en entidad y en plataforma vería la otra
 * vista stale para siempre (`refetchOnWindowFocus: false`); cada hook
 * invalida ambas familias por prefijo (la de entidad acotada a su orgId,
 * que es la única lista que esa vista muestra).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { HelpRequestRow } from "@/lib/api/types";

export type AcknowledgeHelpRequestErrorKind = "sin_permiso" | "desconocido";

export class AcknowledgeHelpRequestError extends Error {
  readonly kind: AcknowledgeHelpRequestErrorKind;

  constructor(kind: AcknowledgeHelpRequestErrorKind, message: string) {
    super(message);
    this.name = "AcknowledgeHelpRequestError";
    this.kind = kind;
  }
}

export function useAcknowledgeHelpRequest(
  orgId: number | string,
): UseMutationResult<HelpRequestRow, AcknowledgeHelpRequestError, string> {
  const queryClient = useQueryClient();

  return useMutation<HelpRequestRow, AcknowledgeHelpRequestError, string>({
    mutationFn: async (helpRequestId) => {
      try {
        return await apiFetch<HelpRequestRow>(SAFETY.HELP_REQUEST_ACKNOWLEDGE(helpRequestId), {
          method: "POST",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new AcknowledgeHelpRequestError("sin_permiso", "No tienes permiso para atender este aviso.");
        }
        throw new AcknowledgeHelpRequestError("desconocido", "No se pudo marcar el aviso como atendido.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-help-requests-pending", orgId] });
      queryClient.invalidateQueries({ queryKey: ["panel-platform-help-requests-pending"] });
      // Los dos Inicios cuentan avisos pendientes por su cuenta
      // (`useEntityHome.ts`, `useDashboardStats.ts`): sin invalidarlos,
      // sus tarjetas seguían con el número de antes hasta recargar.
      queryClient.invalidateQueries({ queryKey: ["panel-home-pending-help-requests", orgId] });
      queryClient.invalidateQueries({ queryKey: ["panel-dashboard-stats"] });
    },
  });
}
