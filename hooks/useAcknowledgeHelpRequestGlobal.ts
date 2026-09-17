"use client";

/**
 * `POST /api/safety/help-requests/{id}/acknowledge/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §5), llamada desde «Ayuda» de
 * plataforma (tarea W5): mismo endpoint que
 * `hooks/useAcknowledgeHelpRequest.ts` (panel de entidad). Antes cada
 * hook invalidaba solo su propia clave de pendientes — y quien tiene rol
 * en entidad y en plataforma dejaba la otra vista stale para siempre
 * (`refetchOnWindowFocus: false`). Ahora ambos cruzan el «He contactado»
 * a la otra vista: este invalida por prefijo la familia de entidad
 * (`["panel-help-requests-pending"]`, cubre la de cualquier orgId)
 * además de la global, y el hook de entidad invalida la suya acotada a
 * su orgId y también la global.
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
      queryClient.invalidateQueries({ queryKey: ["panel-help-requests-pending"] });
      queryClient.invalidateQueries({ queryKey: ["panel-platform-help-requests-pending"] });
      // Igual que el hook de entidad, pero desde plataforma no se sabe de
      // qué entidad es el aviso: la familia de contadores de Inicio se
      // invalida entera por prefijo.
      queryClient.invalidateQueries({ queryKey: ["panel-home-pending-help-requests"] });
      queryClient.invalidateQueries({ queryKey: ["panel-dashboard-stats"] });
    },
  });
}
