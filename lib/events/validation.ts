/**
 * Validación en cliente de `ActividadForm.tsx`, mismo mensaje literal
 * que el 400 real del backend (`events/serializers.py`,
 * `events/services.py::create_event`) para no lanzar una petición que ya
 * sabemos que va a fallar y para que el mensaje del cliente coincida si
 * de todos modos llega a pedirse — verificado contra
 * `~/Code/popyplan/locale/es/LC_MESSAGES/django.po`:
 *
 * - `starts_at` en el futuro: «La actividad tiene que empezar en el
 *   futuro.» (`EventCreateSerializer.validate_starts_at`).
 * - `ends_at` no puede ser anterior o igual a `starts_at`:
 *   «La actividad no puede terminar antes de empezar.»
 *   (`EventCreateSerializer.validate`).
 * - `capacity` mínimo 1: «El aforo mínimo es de una plaza.»
 *   (`EventCreateSerializer.validate_capacity`).
 * - `audience: 'community'` sin comunidad: «Una actividad solo para la
 *   comunidad necesita comunidad.» (`events/services.py::create_event`).
 *
 * **i18n**: funciones `.ts` planas (no pueden llamar a `t()`) — cada una
 * devuelve la **clave** de traducción, o `null` si el campo es válido;
 * `ActividadForm.tsx` la traduce (mismo patrón que
 * `lib/programs/validation.ts::validateProgramDates`).
 */

export const EVENT_STARTS_AT_PAST_ERROR_KEY = "entidad.actividadForm.errors.startsAtPast";
export const EVENT_ENDS_AT_BEFORE_STARTS_AT_ERROR_KEY =
  "entidad.actividadForm.errors.endsAtBeforeStartsAt";
export const EVENT_CAPACITY_TOO_LOW_ERROR_KEY = "entidad.actividadForm.errors.capacityTooLow";
export const EVENT_COMMUNITY_REQUIRED_ERROR_KEY = "entidad.actividadForm.errors.communityRequired";

/**
 * `startsAtIso`/`originalStartsAtIso` son ISO (ya convertidos desde el
 * `datetime-local` del formulario). Al editar, si no cambió respecto al
 * valor original, no hay nada que validar — no se va a reenviar (ver
 * `EventUpdateFields` en `lib/api/types.ts`).
 */
export function validateEventStartsAt(
  startsAtIso: string,
  originalStartsAtIso?: string,
): string | null {
  if (!startsAtIso) return null;
  if (originalStartsAtIso && startsAtIso === originalStartsAtIso) return null;
  return new Date(startsAtIso).getTime() <= Date.now() ? EVENT_STARTS_AT_PAST_ERROR_KEY : null;
}

export function validateEventEndsAt(startsAtIso: string, endsAtIso: string): string | null {
  if (!startsAtIso || !endsAtIso) return null;
  const starts = new Date(startsAtIso).getTime();
  const ends = new Date(endsAtIso).getTime();
  if (Number.isNaN(starts) || Number.isNaN(ends)) return null;
  return ends <= starts ? EVENT_ENDS_AT_BEFORE_STARTS_AT_ERROR_KEY : null;
}

/** `capacity` es el texto tal cual del `<input type="number">`; vacío = sin aforo, válido. */
export function validateEventCapacity(capacity: string): string | null {
  const trimmed = capacity.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed < 1 ? EVENT_CAPACITY_TOO_LOW_ERROR_KEY : null;
}

export function validateEventCommunity(
  audience: "anyone" | "community" | "organization",
  community: string,
): string | null {
  return audience === "community" && !community ? EVENT_COMMUNITY_REQUIRED_ERROR_KEY : null;
}
