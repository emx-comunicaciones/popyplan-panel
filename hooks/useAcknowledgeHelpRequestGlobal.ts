"use client";

/**
 * `POST /api/safety/help-requests/{id}/acknowledge/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §5), llamada desde «Ayuda» de
 * plataforma (tarea W5): mismo endpoint que
 * `hooks/useAcknowledgeHelpRequest.ts` (panel de entidad), pero esa
 * invalida `["panel-help-requests-pending", orgId]` — una clave que la
 * vista global no usa (`usePlatformPendingHelpRequests`, clave
 * `["panel-platform-help-requests-pending"]`). En vez de acoplar el hook
 * de entidad a una clave que no le pertenece, este hook aparte hace la
 * misma llamada e invalida la clave global.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { HelpRequestRow } from "@/lib/api/types";

export class AcknowledgeHelpRequestGlobalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcknowledgeHelpRequestGlobalError";
  }
}

export function useAcknowledgeHelpRequestGlobal(): UseMutationResult<
  HelpRequestRow,
  AcknowledgeHelpRequestGlobalError,
  string
> {
  const queryClient = useQueryClient();

  return useMutation<HelpRequestRow, AcknowledgeHelpRequestGlobalError, string>({
    mutationFn: async (helpRequestId) => {
      try {
        return await apiFetch<HelpRequestRow>(SAFETY.HELP_REQUEST_ACKNOWLEDGE(helpRequestId), {
          method: "POST",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new AcknowledgeHelpRequestGlobalError("No tienes permiso para atender este aviso.");
        }
        throw new AcknowledgeHelpRequestGlobalError("No se pudo marcar el aviso como atendido.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-platform-help-requests-pending"] });
    },
  });
}
