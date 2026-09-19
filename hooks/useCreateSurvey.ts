"use client";

/**
 * `POST /api/panel/entidad/{org_id}/surveys/ {title, kind, opens_at?,
 * closes_at?, questions}` (`docs/PANEL.md` §6.2): crea una encuesta
 * periódica desde el panel (`kind='periodic'`; `post_event` solo lo crea
 * el backend automáticamente al completar una actividad, §6.3 — esta
 * mutación no la ofrece). Solo titular/moderador.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { PANEL } from "@/lib/api/endpoints";
import type { Survey, SurveyCreateRequest } from "@/lib/api/types";

export type CreateSurveyErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class CreateSurveyError extends Error {
  readonly kind: CreateSurveyErrorKind;
  readonly detail?: string;

  constructor(kind: CreateSurveyErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "CreateSurveyError";
    this.kind = kind;
    this.detail = detail;
  }
}

export function useCreateSurvey(
  orgId: number | string,
): UseMutationResult<Survey, CreateSurveyError, SurveyCreateRequest> {
  const queryClient = useQueryClient();

  return useMutation<Survey, CreateSurveyError, SurveyCreateRequest>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<Survey>(PANEL.SURVEYS(orgId), { method: "POST", body: input });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new CreateSurveyError(
            "invalido",
            detail ?? "Revisa los datos: alguna pregunta no es válida.",
            detail,
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new CreateSurveyError("sin_permiso", "Solo titular o moderador pueden crear encuestas.");
        }
        throw new CreateSurveyError("desconocido", "No se pudo crear la encuesta.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-surveys", orgId] });
    },
  });
}
