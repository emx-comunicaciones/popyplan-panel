"use client";

/**
 * Escrituras de la búsqueda del tesoro (admin de plataforma, bloque 2,
 * 2026-09-26; `docs/PANEL.md` §16 del backend). Mismo patrón que
 * `useProgramMutations.ts`: el 400 viaja con el texto literal del backend
 * (`detailOf`) en `detail`, que `errorKindText` pinta tal cual.
 *
 * Invalidaciones: todo lo que cambia el juego (datos, estado, pistas,
 * participantes) invalida la ficha y el listado — el listado enseña estado,
 * `steps_count` y `participants_count`.
 */
import { useMutation, useQueryClient, type QueryClient, type UseMutationResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { TREASURE_HUNT } from "@/lib/api/endpoints";
import type {
  TreasureCompletionValidateInput,
  TreasureCompletionValidateResponse,
  TreasureGame,
  TreasureGameDetail,
  TreasureGameWriteInput,
  TreasurePrizeTier,
  TreasurePrizeTierInput,
  TreasureStep,
  TreasureStepWriteInput,
} from "@/lib/api/types";

import {
  TREASURE_COMPLETIONS_KEY,
  TREASURE_GAME_KEY,
  TREASURE_GAMES_KEY,
  TREASURE_PARTICIPANTS_KEY,
  TREASURE_PRIZE_TIERS_KEY,
  TREASURE_RANKING_KEY,
  TREASURE_STEPS_KEY,
  toTreasureHuntError,
  type TreasureHuntError,
} from "./useTreasureHunt";

/**
 * Con imagen, un `FormData` (el resto de campos como cadenas; `null` →
 * cadena vacía, que DRF lee como «sin valor» en un campo nullable); sin
 * ella, el JSON de siempre. Mismo criterio que
 * `useUpdateOrganization.ts::buildOrganizationPayload`.
 */
export function buildGamePayload(input: Partial<TreasureGameWriteInput>): FormData | Partial<TreasureGameWriteInput> {
  if (!input.image) return input;
  const formData = new FormData();
  for (const [field, value] of Object.entries(input)) {
    if (field === "image" || value === undefined) continue;
    formData.append(field, value === null ? "" : String(value));
  }
  formData.append("image", input.image);
  return formData;
}

function invalidateGame(queryClient: QueryClient, gameId: string) {
  void queryClient.invalidateQueries({ queryKey: [TREASURE_GAMES_KEY] });
  void queryClient.invalidateQueries({ queryKey: [TREASURE_GAME_KEY, String(gameId)] });
}

export function useCreateTreasureGame(): UseMutationResult<TreasureGame, TreasureHuntError, TreasureGameWriteInput> {
  const queryClient = useQueryClient();
  return useMutation<TreasureGame, TreasureHuntError, TreasureGameWriteInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<TreasureGame>(TREASURE_HUNT.LIST(), { method: "POST", body: buildGamePayload(input) });
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo crear el juego.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TREASURE_GAMES_KEY] });
    },
  });
}

export function useUpdateTreasureGame(
  gameId: string,
): UseMutationResult<TreasureGameDetail, TreasureHuntError, Partial<TreasureGameWriteInput>> {
  const queryClient = useQueryClient();
  return useMutation<TreasureGameDetail, TreasureHuntError, Partial<TreasureGameWriteInput>>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<TreasureGameDetail>(TREASURE_HUNT.DETAIL(gameId), {
          method: "PATCH",
          body: buildGamePayload(input),
        });
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo guardar el juego.");
      }
    },
    // El `PATCH` responde el `GameDetail` completo: se escribe en la caché
    // antes de invalidar, para que la ficha (y su formulario, que se
    // remonta al guardar) vean ya los valores nuevos sin esperar al refetch.
    onSuccess: (detail) => {
      queryClient.setQueryData([TREASURE_GAME_KEY, String(gameId)], detail);
      invalidateGame(queryClient, gameId);
    },
  });
}

export function useDeleteTreasureGame(): UseMutationResult<void, TreasureHuntError, string> {
  const queryClient = useQueryClient();
  return useMutation<void, TreasureHuntError, string>({
    mutationFn: async (gameId) => {
      try {
        await apiFetch(TREASURE_HUNT.DETAIL(gameId), { method: "DELETE" });
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo borrar el juego.");
      }
    },
    onSuccess: (_data, gameId) => {
      void queryClient.invalidateQueries({ queryKey: [TREASURE_GAMES_KEY] });
      queryClient.removeQueries({ queryKey: [TREASURE_GAME_KEY, String(gameId)] });
    },
  });
}

export type TreasureLifecycleAction = "open" | "start" | "finish";

const LIFECYCLE_PATH: Record<TreasureLifecycleAction, (id: string) => string> = {
  open: TREASURE_HUNT.OPEN,
  start: TREASURE_HUNT.START,
  finish: TREASURE_HUNT.FINISH,
};

/** Abrir inscripciones / empezar / terminar. El `detail` de éxito es informativo: se refresca la ficha. */
export function useTreasureLifecycle(
  gameId: string,
): UseMutationResult<unknown, TreasureHuntError, TreasureLifecycleAction> {
  const queryClient = useQueryClient();
  return useMutation<unknown, TreasureHuntError, TreasureLifecycleAction>({
    mutationFn: async (action) => {
      try {
        return await apiFetch(LIFECYCLE_PATH[action](gameId), { method: "POST" });
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo cambiar el estado del juego.");
      }
    },
    onSuccess: () => {
      invalidateGame(queryClient, gameId);
      void queryClient.invalidateQueries({ queryKey: [TREASURE_PARTICIPANTS_KEY, String(gameId)] });
      void queryClient.invalidateQueries({ queryKey: [TREASURE_RANKING_KEY, String(gameId)] });
    },
  });
}

export interface SaveStepVariables {
  /** Sin `stepId`, alta; con él, edición. */
  stepId?: string;
  input: TreasureStepWriteInput;
}

export function useSaveTreasureStep(gameId: string): UseMutationResult<TreasureStep, TreasureHuntError, SaveStepVariables> {
  const queryClient = useQueryClient();
  return useMutation<TreasureStep, TreasureHuntError, SaveStepVariables>({
    mutationFn: async ({ stepId, input }) => {
      try {
        return stepId
          ? await apiFetch<TreasureStep>(TREASURE_HUNT.STEP(gameId, stepId), { method: "PATCH", body: input })
          : await apiFetch<TreasureStep>(TREASURE_HUNT.STEPS(gameId), { method: "POST", body: input });
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo guardar la prueba.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TREASURE_STEPS_KEY, String(gameId)] });
      invalidateGame(queryClient, gameId);
    },
  });
}

export function useDeleteTreasureStep(gameId: string): UseMutationResult<void, TreasureHuntError, string> {
  const queryClient = useQueryClient();
  return useMutation<void, TreasureHuntError, string>({
    mutationFn: async (stepId) => {
      try {
        await apiFetch(TREASURE_HUNT.STEP(gameId, stepId), { method: "DELETE" });
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo borrar la prueba.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TREASURE_STEPS_KEY, String(gameId)] });
      invalidateGame(queryClient, gameId);
    },
  });
}

export interface SavePrizeTierVariables {
  tierId?: string;
  input: TreasurePrizeTierInput;
}

export function useSaveTreasurePrizeTier(
  gameId: string,
): UseMutationResult<TreasurePrizeTier, TreasureHuntError, SavePrizeTierVariables> {
  const queryClient = useQueryClient();
  return useMutation<TreasurePrizeTier, TreasureHuntError, SavePrizeTierVariables>({
    mutationFn: async ({ tierId, input }) => {
      try {
        return tierId
          ? await apiFetch<TreasurePrizeTier>(TREASURE_HUNT.PRIZE_TIER(gameId, tierId), { method: "PATCH", body: input })
          : await apiFetch<TreasurePrizeTier>(TREASURE_HUNT.PRIZE_TIERS(gameId), { method: "POST", body: input });
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo guardar el premio.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TREASURE_PRIZE_TIERS_KEY, String(gameId)] });
      void queryClient.invalidateQueries({ queryKey: [TREASURE_GAME_KEY, String(gameId)] });
    },
  });
}

export function useDeleteTreasurePrizeTier(gameId: string): UseMutationResult<void, TreasureHuntError, string> {
  const queryClient = useQueryClient();
  return useMutation<void, TreasureHuntError, string>({
    mutationFn: async (tierId) => {
      try {
        await apiFetch(TREASURE_HUNT.PRIZE_TIER(gameId, tierId), { method: "DELETE" });
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo borrar el premio.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TREASURE_PRIZE_TIERS_KEY, String(gameId)] });
      void queryClient.invalidateQueries({ queryKey: [TREASURE_GAME_KEY, String(gameId)] });
    },
  });
}

export interface DecideParticipantVariables {
  participantId: number;
  approve: boolean;
}

export function useDecideTreasureParticipant(
  gameId: string,
): UseMutationResult<unknown, TreasureHuntError, DecideParticipantVariables> {
  const queryClient = useQueryClient();
  return useMutation<unknown, TreasureHuntError, DecideParticipantVariables>({
    mutationFn: async ({ participantId, approve }) => {
      const path = approve
        ? TREASURE_HUNT.PARTICIPANT_APPROVE(gameId, participantId)
        : TREASURE_HUNT.PARTICIPANT_REJECT(gameId, participantId);
      try {
        return await apiFetch(path, { method: "POST" });
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo resolver la solicitud.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TREASURE_PARTICIPANTS_KEY, String(gameId)] });
      invalidateGame(queryClient, gameId);
    },
  });
}

export interface ValidateCompletionVariables {
  completionId: string;
  input: TreasureCompletionValidateInput;
}

export function useValidateTreasureCompletion(
  gameId: string,
): UseMutationResult<TreasureCompletionValidateResponse, TreasureHuntError, ValidateCompletionVariables> {
  const queryClient = useQueryClient();
  return useMutation<TreasureCompletionValidateResponse, TreasureHuntError, ValidateCompletionVariables>({
    mutationFn: async ({ completionId, input }) => {
      try {
        return await apiFetch<TreasureCompletionValidateResponse>(
          TREASURE_HUNT.COMPLETION_VALIDATE(gameId, completionId),
          { method: "POST", body: input },
        );
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo validar el envío.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TREASURE_COMPLETIONS_KEY, String(gameId)] });
      void queryClient.invalidateQueries({ queryKey: [TREASURE_RANKING_KEY, String(gameId)] });
    },
  });
}
