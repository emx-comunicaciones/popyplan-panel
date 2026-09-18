/**
 * Validación en cliente del rango de población de un tramo de precio
 * (`ContratosPanel.tsx::TierForm`, `docs/PANEL.md` §13.1), mismo patrón
 * que `lib/programs/validation.ts::validateProgramDates`: se comprueba
 * antes de lanzar una petición que ya sabemos que va a fallar, y el
 * backend la vuelve a validar de todos modos.
 *
 * Los dos campos son `<input type="number">`, así que el navegador ya
 * deja el valor en blanco cuando se teclea algo que no es un número:
 * `noEsNumero` es defensa, no el caso corriente — aquí es donde se
 * prueba, porque a través del formulario no hay forma de provocarlo.
 */

export const TIER_MIN_NEGATIVE_ERROR = "La población mínima no puede ser negativa.";
export const TIER_MAX_INVALID_ERROR = "La población máxima no es válida.";
export const TIER_MAX_BELOW_MIN_ERROR = "La población máxima no puede ser menor que la mínima.";

export interface TierRange {
  min: number;
  /** `null` = sin tope (el campo vacío). */
  max: number | null;
}

/** `null` si el rango es válido; si no, el mensaje que se pinta bajo los campos. */
export function validateTierRange({ min, max }: TierRange): string | null {
  if (!Number.isFinite(min) || min < 0) return TIER_MIN_NEGATIVE_ERROR;
  if (max === null) return null;
  if (!Number.isFinite(max)) return TIER_MAX_INVALID_ERROR;
  return max < min ? TIER_MAX_BELOW_MIN_ERROR : null;
}

/** Lee los dos campos del formulario: vacío = `0` para el mínimo, «sin tope» para el máximo. */
export function tierRangeFromFields(minField: string, maxField: string): TierRange {
  return {
    min: minField.trim() === "" ? 0 : Number(minField),
    max: maxField.trim() === "" ? null : Number(maxField),
  };
}
