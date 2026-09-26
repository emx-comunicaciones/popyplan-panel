"use client";

/**
 * Lo que una persona inscrita en el programa de seguimiento comparte con
 * su **referente asignado** (`docs/PANEL.md` §18.6, datos de salud). Solo
 * la cuenta detrás de `ProgramEnrollment.referent`, con la inscripción
 * aceptada y el servicio encendido; cualquier otra (titular, moderador,
 * otro referente, plataforma) recibe **404**, igual que el referente
 * mientras la inscripción está pendiente. Cada `GET` deja una fila
 * `program.shared_read` en `AuditLog`: quien llama monta el hook solo para
 * `role === 'referente'` y con el servicio encendido, para no generar
 * lecturas (ni 404) de más.
 *
 * Mismo criterio que `usePersonSupport`: 403/404 → `sin_acceso`, y el
 * componente **no pinta nada** con ese `kind` (su existencia ya es un dato).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { TRACKING } from "@/lib/api/endpoints";
import type { ProposeGoalInput, ProposedGoal, SharedTracking } from "@/lib/api/types";

export type SharedTrackingErrorKind = "sin_acceso" | "desconocido";

export class SharedTrackingError extends Error {
  readonly kind: SharedTrackingErrorKind;
  readonly detail?: string;

  constructor(kind: SharedTrackingErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "SharedTrackingError";
    this.kind = kind;
    this.detail = detail;
  }
}

const SHARED_KEY = "panel-program-shared";

export function useSharedTracking(
  orgId: number | string,
  userId: number | string,
  enabled: boolean,
): UseQueryResult<SharedTracking, SharedTrackingError> {
  return useQuery<SharedTracking, SharedTrackingError>({
    queryKey: [SHARED_KEY, String(orgId), String(userId)],
    enabled,
    queryFn: async () => {
      try {
        return await apiFetch<SharedTracking>(TRACKING.SHARED(orgId, userId));
      } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
          throw new SharedTrackingError("sin_acceso", "Sin acceso al seguimiento de esta persona.");
        }
        const detail = error instanceof ApiError ? detailOf(error) : undefined;
        throw new SharedTrackingError(
          "desconocido",
          detail ?? "No se pudo cargar el seguimiento compartido.",
          detail,
        );
      }
    },
  });
}

export type ProposeGoalErrorKind = "invalido" | "sin_acceso" | "desconocido";

export class ProposeGoalError extends Error {
  readonly kind: ProposeGoalErrorKind;
  readonly detail?: string;

  constructor(kind: ProposeGoalErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "ProposeGoalError";
    this.kind = kind;
    this.detail = detail;
  }
}

/**
 * `POST .../people/{user_id}/goals/ {title, week?}` → 201 `{id,
 * week_start, title}`. 400 con el texto del backend (título vacío, semana
 * mal escrita, tope de 10 por semana…); 404 si ya no es su referente o la
 * inscripción dejó de estar activa. Refresca lo compartido (el objetivo
 * propuesto sale en `goals` si la persona comparte objetivos).
 */
export function useProposeGoal(
  orgId: number | string,
  userId: number | string,
): UseMutationResult<ProposedGoal, ProposeGoalError, ProposeGoalInput> {
  const queryClient = useQueryClient();
  return useMutation<ProposedGoal, ProposeGoalError, ProposeGoalInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<ProposedGoal>(TRACKING.PROPOSE_GOAL(orgId, userId), { method: "POST", body: input });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new ProposeGoalError("invalido", detail ?? "Revisa el objetivo: no es válido.", detail);
        }
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
          throw new ProposeGoalError("sin_acceso", "Ya no puedes proponer objetivos a esta persona.");
        }
        throw new ProposeGoalError("desconocido", "No se pudo proponer el objetivo.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [SHARED_KEY, String(orgId), String(userId)] });
    },
  });
}
