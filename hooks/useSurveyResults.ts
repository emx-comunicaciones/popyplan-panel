"use client";

/**
 * `GET /api/panel/entidad/{org_id}/surveys/{sid}/results/` (`docs/PANEL.md`
 * §6.6): resultados agregados, con umbral de agregación
 * (`PANEL_MIN_GROUP_SIZE`) por pregunta — nunca nominal, así que
 * `ver_panel` basta (no hace falta `ver_lista_nominal`).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { PANEL } from "@/lib/api/endpoints";
import type { SurveyResults } from "@/lib/api/types";

export type SurveyResultsErrorKind = "sin_acceso" | "no_encontrada" | "desconocido";

export class SurveyResultsError extends Error {
  readonly kind: SurveyResultsErrorKind;

  constructor(kind: SurveyResultsErrorKind, message: string) {
    super(message);
    this.name = "SurveyResultsError";
    this.kind = kind;
  }
}

export function useSurveyResults(
  orgId: number | string,
  surveyId: number | string,
): UseQueryResult<SurveyResults, SurveyResultsError> {
  return useQuery<SurveyResults, SurveyResultsError>({
    queryKey: ["panel-survey-results", orgId, surveyId],
    queryFn: async () => {
      try {
        return await apiFetch<SurveyResults>(PANEL.SURVEY_RESULTS(orgId, surveyId));
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new SurveyResultsError("sin_acceso", "No tienes acceso a los resultados de esta encuesta.");
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new SurveyResultsError("no_encontrada", "Esta encuesta no existe.");
        }
        throw new SurveyResultsError("desconocido", "No se pudieron cargar los resultados.");
      }
    },
    enabled: Boolean(surveyId),
  });
}
