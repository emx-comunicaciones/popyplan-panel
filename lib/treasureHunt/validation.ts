/**
 * Validaciones en cliente de la búsqueda del tesoro (admin de plataforma,
 * bloque 2). Devuelven un `kind` corto, nunca texto: el componente lo
 * traduce (patrón de `lib/people/validateImportFile.ts`). Reflejan las
 * reglas del backend (`treasure_hunt/serializers.py`) para no esperar a
 * un 400 — el backend valida otra vez de todos modos.
 */
import type { TreasureChallengeType, TreasurePrizeTier, TreasureStep } from "@/lib/api/types";
import { extensionOf, type ValidatableFile } from "@/lib/resources/validateFile";

export const GAME_IMAGE_MAX_MB = 5;
const GAME_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

export type GameImageErrorKind = "tipo_no_permitido" | "demasiado_grande";

/**
 * Imagen del juego (`Game.image`, `ImageField`): el backend no impone
 * tamaño; el panel se queda en 5 MB y en los formatos que Pillow abre y
 * que la app pinta (un SVG no pasa, como en el logo de entidad).
 */
export function validateGameImage(file: ValidatableFile): GameImageErrorKind | null {
  if (!GAME_IMAGE_EXTENSIONS.includes(extensionOf(file.name))) return "tipo_no_permitido";
  if (file.size > GAME_IMAGE_MAX_MB * 1024 * 1024) return "demasiado_grande";
  return null;
}

export type PrizeTierErrorKind = "rango_invalido" | "desde_mayor" | "solapa";

/**
 * `PrizeTierSerializer.validate`: `rank_from ≤ rank_to` y ningún solape
 * (`rank_from__lte=rank_to, rank_to__gte=rank_from`) con otro tramo del
 * mismo juego, excluyendo el que se edita. Posiciones enteras desde 1.
 */
export function validatePrizeTier(
  rankFrom: number,
  rankTo: number,
  existing: readonly Pick<TreasurePrizeTier, "id" | "rank_from" | "rank_to">[],
  editingId?: string,
): PrizeTierErrorKind | null {
  if (!Number.isInteger(rankFrom) || !Number.isInteger(rankTo) || rankFrom < 1 || rankTo < 1) {
    return "rango_invalido";
  }
  if (rankFrom > rankTo) return "desde_mayor";
  const overlaps = existing.some(
    (tier) => tier.id !== editingId && tier.rank_from <= rankTo && tier.rank_to >= rankFrom,
  );
  return overlaps ? "solapa" : null;
}

/** Siguiente `order` libre: uno más que el mayor (las pistas empiezan en 1). */
export function nextStepOrder(steps: readonly Pick<TreasureStep, "order">[]): number {
  return steps.reduce((max, step) => Math.max(max, step.order), 0) + 1;
}

export type StepErrorKind = "orden_invalido" | "orden_repetido" | "sin_pista" | "sin_respuesta" | "sin_coordenadas" | "coordenadas_invalidas";

export interface StepDraft {
  order: number;
  clue: string;
  challengeType: TreasureChallengeType;
  /** Respuesta tecleada; vacía al editar = «conserva la guardada». */
  correctAnswer: string;
  latitude: string;
  longitude: string;
}

/**
 * `GameStepCreateSerializer.validate` más una regla que el backend no
 * comprueba con un 400: `order` es `unique_together` con el juego pero
 * `game` no está en los campos del serializer, así que un orden repetido
 * no da un error de validación sino un `IntegrityError` (500). El panel lo
 * impide antes de mandar nada.
 *
 * `hasStoredAnswer`: al editar una pista que ya era `answer`, el backend
 * conserva su `correct_answer` (solo de escritura, nunca se devuelve), así
 * que dejar el campo vacío es válido.
 */
export function validateStep(
  draft: StepDraft,
  steps: readonly Pick<TreasureStep, "id" | "order">[],
  editingId?: string,
  hasStoredAnswer = false,
): StepErrorKind | null {
  if (!Number.isInteger(draft.order) || draft.order < 1) return "orden_invalido";
  if (steps.some((step) => step.id !== editingId && step.order === draft.order)) return "orden_repetido";
  if (!draft.clue.trim()) return "sin_pista";
  if (draft.challengeType === "answer" && !draft.correctAnswer.trim() && !hasStoredAnswer) return "sin_respuesta";
  if (draft.challengeType === "location") {
    if (!draft.latitude.trim() || !draft.longitude.trim()) return "sin_coordenadas";
    const lat = Number(draft.latitude.replace(",", "."));
    const lng = Number(draft.longitude.replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return "coordenadas_invalidas";
    }
  }
  return null;
}

/** Coordenada tecleada (admite coma decimal) → número, o `null` si está vacía o no es un número. */
export function parseCoordinate(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
