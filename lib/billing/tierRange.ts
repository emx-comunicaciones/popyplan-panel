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
 *
 * **i18n (tarea 5 del plan de i18n):** este módulo es `.ts` plano (no
 * puede llamar a `t()`) — `validateTierRange` devuelve la **clave** de
 * traducción, o `null` si el rango es válido; `ContratosPanel.tsx::TierForm`
 * la traduce, mismo patrón que `PROGRAM_ENDS_ON_ERROR_KEY`.
 */

export const TIER_MIN_NEGATIVE_ERROR_KEY = "plataforma.contratos.tierErrors.minNegative";
export const TIER_MAX_INVALID_ERROR_KEY = "plataforma.contratos.tierErrors.maxInvalid";
export const TIER_MAX_BELOW_MIN_ERROR_KEY = "plataforma.contratos.tierErrors.maxBelowMin";

export interface TierRange {
  min: number;
  /** `null` = sin tope (el campo vacío). */
  max: number | null;
}

/** `null` si el rango es válido; si no, la clave del mensaje que se pinta bajo los campos. */
export function validateTierRange({ min, max }: TierRange): string | null {
  if (!Number.isFinite(min) || min < 0) return TIER_MIN_NEGATIVE_ERROR_KEY;
  if (max === null) return null;
  if (!Number.isFinite(max)) return TIER_MAX_INVALID_ERROR_KEY;
  return max < min ? TIER_MAX_BELOW_MIN_ERROR_KEY : null;
}

/** Lee los dos campos del formulario: vacío = `0` para el mínimo, «sin tope» para el máximo. */
export function tierRangeFromFields(minField: string, maxField: string): TierRange {
  return {
    min: minField.trim() === "" ? 0 : Number(minField),
    max: maxField.trim() === "" ? null : Number(maxField),
  };
}
