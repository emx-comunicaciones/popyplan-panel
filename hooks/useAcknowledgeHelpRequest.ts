"use client";

/**
 * `POST /api/safety/help-requests/{id}/acknowledge/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §5): «He contactado». Invalida la
 * lista de pendientes tras marcarlo.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { HelpRequestRow } from "@/lib/api/types";

export class AcknowledgeHelpRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcknowledgeHelpRequestError";
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
          throw new AcknowledgeHelpRequestError("No tienes permiso para atender este aviso.");
        }
        throw new AcknowledgeHelpRequestError("No se pudo marcar el aviso como atendido.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-help-requests-pending", orgId] });
    },
  });
}
