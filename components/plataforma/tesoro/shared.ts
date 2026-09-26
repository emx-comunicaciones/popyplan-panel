/**
 * Piezas compartidas de la búsqueda del tesoro (admin de plataforma,
 * bloque 2): mapas de claves de traducción (nunca texto) y formato de
 * fechas con el idioma activo.
 */
import type { BadgeTone } from "@/components/ui/Badge";
import type { TreasureHuntErrorKind } from "@/hooks/useTreasureHunt";
import type { TreasureChallengeType, TreasureGameStatus, TreasureParticipantStatus } from "@/lib/api/types";
import { activeLanguage, localeFor } from "@/lib/i18n/locale";

export const TREASURE_ERROR_KEYS: Record<TreasureHuntErrorKind, string> = {
  invalido: "errors.treasureHunt.invalido",
  sin_acceso: "errors.treasureHunt.sinAcceso",
  no_encontrado: "errors.treasureHunt.noEncontrado",
  desconocido: "errors.treasureHunt.desconocido",
};

export const TREASURE_ERROR_FALLBACK = "errors.treasureHunt.desconocido";

export const GAME_STATUS_KEYS: Record<TreasureGameStatus, string> = {
  draft: "plataforma.tesoro.status.draft",
  open: "plataforma.tesoro.status.open",
  in_progress: "plataforma.tesoro.status.inProgress",
  finished: "plataforma.tesoro.status.finished",
  cancelled: "plataforma.tesoro.status.cancelled",
};

export const GAME_STATUS_TONES: Record<TreasureGameStatus, BadgeTone> = {
  draft: "neutral",
  open: "info",
  in_progress: "success",
  finished: "neutral",
  cancelled: "error",
};

export const CHALLENGE_TYPES: readonly TreasureChallengeType[] = ["answer", "photo", "location", "social"];

export const CHALLENGE_TYPE_KEYS: Record<TreasureChallengeType, string> = {
  answer: "plataforma.tesoro.challenge.answer",
  photo: "plataforma.tesoro.challenge.photo",
  location: "plataforma.tesoro.challenge.location",
  social: "plataforma.tesoro.challenge.social",
};

export const PARTICIPANT_STATUS_KEYS: Record<TreasureParticipantStatus, string> = {
  pending: "plataforma.tesoro.participantes.status.pending",
  accepted: "plataforma.tesoro.participantes.status.accepted",
  rejected: "plataforma.tesoro.participantes.status.rejected",
};

/** Estado con reserva: un valor que el backend añada se pinta crudo en vez de romper. */
export function gameStatusKey(status: string | undefined): string | null {
  return status && status in GAME_STATUS_KEYS ? GAME_STATUS_KEYS[status as TreasureGameStatus] : null;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(localeFor(activeLanguage()), { dateStyle: "medium", timeStyle: "short" });
}

export const FIELD_CLASS = "w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700";
export const LABEL_CLASS = "mb-1 block text-sm font-medium text-text-form";
