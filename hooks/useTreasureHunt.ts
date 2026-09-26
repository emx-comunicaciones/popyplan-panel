"use client";

/**
 * Lecturas de la búsqueda del tesoro (admin de plataforma, bloque 2,
 * 2026-09-26; `docs/PANEL.md` §16 del backend). Todas piden
 * `is_staff`/superadmin y **ninguna pagina**: arrays planos
 * (`TreasureHuntViewSet.pagination_class = None`).
 *
 * Claves de caché: el id del juego es un UUID (cadena en la ruta y en la
 * API), pero se normaliza igual con `String(...)` para no repetir el fallo
 * string↔number que CLAUDE.md documenta para `useProgram`.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { TREASURE_HUNT } from "@/lib/api/endpoints";
import type {
  TreasureCompletion,
  TreasureGame,
  TreasureGameDetail,
  TreasureParticipant,
  TreasureParticipantStatus,
  TreasurePrizeTier,
  TreasureRankingRow,
  TreasureStep,
} from "@/lib/api/types";

export type TreasureHuntErrorKind = "invalido" | "sin_acceso" | "no_encontrado" | "desconocido";

export class TreasureHuntError extends Error {
  readonly kind: TreasureHuntErrorKind;
  /** Texto literal del backend (`detailOf`), si lo trae: tiene prioridad al pintarse. */
  readonly detail?: string;

  constructor(kind: TreasureHuntErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "TreasureHuntError";
    this.kind = kind;
    this.detail = detail;
  }
}

/** Traduce un fallo de la API a `TreasureHuntError`; lo comparten lecturas y mutaciones. */
export function toTreasureHuntError(error: unknown, fallback: string): TreasureHuntError {
  if (error instanceof ApiError) {
    const detail = detailOf(error);
    if (error.status === 400) {
      return new TreasureHuntError("invalido", detail ?? "Revisa los datos.", detail);
    }
    if (error.status === 403) {
      return new TreasureHuntError("sin_acceso", "Solo superadmin puede gestionar la búsqueda del tesoro.");
    }
    if (error.status === 404) {
      return new TreasureHuntError("no_encontrado", detail ?? "Este juego ya no existe.", detail);
    }
  }
  return new TreasureHuntError("desconocido", fallback);
}

export const TREASURE_GAMES_KEY = "panel-treasure-games";
export const TREASURE_GAME_KEY = "panel-treasure-game";
export const TREASURE_STEPS_KEY = "panel-treasure-steps";
export const TREASURE_PRIZE_TIERS_KEY = "panel-treasure-prize-tiers";
export const TREASURE_PARTICIPANTS_KEY = "panel-treasure-participants";
export const TREASURE_COMPLETIONS_KEY = "panel-treasure-completions";
export const TREASURE_RANKING_KEY = "panel-treasure-ranking";

function useTreasureList<Row>(
  key: string,
  gameId: string,
  path: string,
  fallback: string,
  extraKey?: string,
): UseQueryResult<Row[], TreasureHuntError> {
  return useQuery<Row[], TreasureHuntError>({
    queryKey: extraKey === undefined ? [key, String(gameId)] : [key, String(gameId), extraKey],
    queryFn: async () => {
      try {
        return await apiFetch<Row[]>(path);
      } catch (error) {
        throw toTreasureHuntError(error, fallback);
      }
    },
  });
}

export function useTreasureGames(): UseQueryResult<TreasureGame[], TreasureHuntError> {
  return useQuery<TreasureGame[], TreasureHuntError>({
    queryKey: [TREASURE_GAMES_KEY],
    queryFn: async () => {
      try {
        return await apiFetch<TreasureGame[]>(TREASURE_HUNT.LIST());
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudieron cargar los juegos.");
      }
    },
  });
}

export function useTreasureGame(gameId: string): UseQueryResult<TreasureGameDetail, TreasureHuntError> {
  return useQuery<TreasureGameDetail, TreasureHuntError>({
    queryKey: [TREASURE_GAME_KEY, String(gameId)],
    queryFn: async () => {
      try {
        return await apiFetch<TreasureGameDetail>(TREASURE_HUNT.DETAIL(gameId));
      } catch (error) {
        throw toTreasureHuntError(error, "No se pudo cargar el juego.");
      }
    },
  });
}

export function useTreasureSteps(gameId: string): UseQueryResult<TreasureStep[], TreasureHuntError> {
  return useTreasureList(TREASURE_STEPS_KEY, gameId, TREASURE_HUNT.STEPS_LIST(gameId), "No se pudieron cargar las pruebas.");
}

export function useTreasurePrizeTiers(gameId: string): UseQueryResult<TreasurePrizeTier[], TreasureHuntError> {
  return useTreasureList(
    TREASURE_PRIZE_TIERS_KEY,
    gameId,
    TREASURE_HUNT.PRIZE_TIERS(gameId),
    "No se pudieron cargar los premios.",
  );
}

/** `status` vacío = todas; la clave lleva el filtro, así que invalidar por `[key, id]` las refresca todas. */
export function useTreasureParticipants(
  gameId: string,
  status: TreasureParticipantStatus | "",
): UseQueryResult<TreasureParticipant[], TreasureHuntError> {
  const path = status
    ? `${TREASURE_HUNT.PARTICIPANTS(gameId)}?status=${status}`
    : TREASURE_HUNT.PARTICIPANTS(gameId);
  return useTreasureList(TREASURE_PARTICIPANTS_KEY, gameId, path, "No se pudieron cargar los participantes.", status);
}

export function useTreasureCompletions(gameId: string): UseQueryResult<TreasureCompletion[], TreasureHuntError> {
  return useTreasureList(
    TREASURE_COMPLETIONS_KEY,
    gameId,
    TREASURE_HUNT.COMPLETIONS(gameId),
    "No se pudieron cargar los envíos pendientes.",
  );
}

export function useTreasureRanking(gameId: string): UseQueryResult<TreasureRankingRow[], TreasureHuntError> {
  return useTreasureList(TREASURE_RANKING_KEY, gameId, TREASURE_HUNT.RANKING(gameId), "No se pudo cargar el ranking.");
}
