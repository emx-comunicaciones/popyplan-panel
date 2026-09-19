/**
 * Validación en cliente de `ProgramaForm.tsx` (`docs/PANEL.md` §12.3):
 * `ends_on < starts_on` es el único error de fechas que el backend valida
 * (`ProgramInputSerializer.validate`, `programs/serializers.py`) — mismo
 * mensaje literal que el 400 real (`{"ends_on": ["La fecha de fin no
 * puede ser anterior a la de inicio."]}`), para no lanzar una petición
 * que ya sabemos que va a fallar y para que el mensaje del cliente
 * coincida siempre con el del backend si de todos modos llega a pedirse.
 *
 * **i18n (tarea 4 del plan de i18n):** `validateProgramDates` es `.ts`
 * plano (no puede llamar a `t()`) — devuelve la **clave** de traducción
 * (`PROGRAM_ENDS_ON_ERROR_KEY`, o `null` si el rango es válido) en vez
 * del mensaje ya construido; `ProgramaForm.tsx` la traduce. El valor en
 * `messages/es.json` bajo esa clave tiene que seguir siendo, letra por
 * letra, el texto del contrato del backend — quien lo toque debe
 * comprobarlo contra `programs/serializers.py` antes de cambiarlo.
 */

export const PROGRAM_ENDS_ON_ERROR_KEY = "programs.errors.endsOnBeforeStartsOn";

/** Clave de traducción del error, o `null` si el rango es válido o falta alguna fecha (otra validación se encarga de exigirlas). */
export function validateProgramDates(startsOn: string, endsOn: string): string | null {
  if (!startsOn || !endsOn) return null;
  return endsOn < startsOn ? PROGRAM_ENDS_ON_ERROR_KEY : null;
}
