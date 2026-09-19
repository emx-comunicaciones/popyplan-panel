"use client";

/**
 * `GET /api/panel/entidad/{org_id}/surveys/` (`docs/PANEL.md` §6):
 * encuestas de la entidad (periódicas creadas desde el panel y
 * post-actividad automáticas), array plano sin paginar. Visible para
 * cualquier rol con `ver_panel`; solo titular/moderador pueden crear una
 * nueva (ver `useCreateSurvey.ts`).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { PANEL } from "@/lib/api/endpoints";
import type { Survey } from "@/lib/api/types";

export type SurveysErrorKind = "sin_acceso" | "desconocido";

export class SurveysError extends Error {
  readonly kind: SurveysErrorKind;

  constructor(kind: SurveysErrorKind, message: string) {
    super(message);
    this.name = "SurveysError";
    this.kind = kind;
  }
}

export function useSurveys(orgId: number | string): UseQueryResult<Survey[], SurveysError> {
  return useQuery<Survey[], SurveysError>({
    queryKey: ["panel-surveys", orgId],
    queryFn: async () => {
      try {
        return await apiFetch<Survey[]>(PANEL.SURVEYS(orgId));
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new SurveysError("sin_acceso", "No tienes acceso a las encuestas de esta entidad.");
        }
        throw new SurveysError("desconocido", "No se pudieron cargar las encuestas.");
      }
    },
  });
}
