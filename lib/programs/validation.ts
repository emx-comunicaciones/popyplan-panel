/**
 * Validación en cliente de `ProgramaForm.tsx` (`docs/PANEL.md` §12.3):
 * `ends_on < starts_on` es el único error de fechas que el backend valida
 * (`ProgramInputSerializer.validate`, `programs/serializers.py`) — mismo
 * mensaje literal que el 400 real (`{"ends_on": ["La fecha de fin no
 * puede ser anterior a la de inicio."]}`), para no lanzar una petición
 * que ya sabemos que va a fallar y para que el mensaje del cliente
 * coincida siempre con el del backend si de todos modos llega a pedirse.
 */

export const PROGRAM_ENDS_ON_ERROR = "La fecha de fin no puede ser anterior a la de inicio.";

/** `null` si el rango es válido o si falta alguna fecha (otra validación se encarga de exigirlas). */
export function validateProgramDates(startsOn: string, endsOn: string): string | null {
  if (!startsOn || !endsOn) return null;
  return endsOn < startsOn ? PROGRAM_ENDS_ON_ERROR : null;
}
