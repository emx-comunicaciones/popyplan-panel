/**
 * Claves de traducción de los valores del programa de seguimiento
 * (`docs/PANEL.md` §18). Devuelven la **clave**, no el texto (una función
 * pura no puede llamar a `t()`), o `null` si el backend manda un valor que
 * el panel todavía no conoce — quien llama cae entonces al valor crudo,
 * mismo patrón que `lib/reports/labels.ts`.
 */

const TRACKING_TYPE_KEYS: Record<string, string> = {
  alcohol: "tracking.type.alcohol",
  drugs: "tracking.type.drugs",
  gambling: "tracking.type.gambling",
  other: "tracking.type.other",
};

const ENROLLMENT_STATUS_KEYS: Record<string, string> = {
  pending: "tracking.status.pending",
  active: "tracking.status.active",
  left: "tracking.status.left",
  closed: "tracking.status.closed",
};

const MOOD_KEYS: Record<string, string> = {
  good: "tracking.mood.good",
  so_so: "tracking.mood.soSo",
  hard: "tracking.mood.hard",
};

const URGE_KEYS: Record<string, string> = {
  none: "tracking.urge.none",
  little: "tracking.urge.little",
  quite: "tracking.urge.quite",
  a_lot: "tracking.urge.aLot",
};

function lookup(map: Record<string, string>, value: string | null | undefined): string | null {
  if (!value) return null;
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : null;
}

export const trackingTypeKey = (value: string | null | undefined) => lookup(TRACKING_TYPE_KEYS, value);
export const enrollmentStatusKey = (value: string | null | undefined) => lookup(ENROLLMENT_STATUS_KEYS, value);
export const moodKey = (value: string | null | undefined) => lookup(MOOD_KEYS, value);
export const urgeKey = (value: string | null | undefined) => lookup(URGE_KEYS, value);

/** Una inscripción «abierta» es la que todavía se puede cambiar o cerrar (409 si no). */
export function isOpenEnrollment(status: string): boolean {
  return status === "pending" || status === "active";
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Texto del tipo de seguimiento: la etiqueta traducida y, con `other`, la
 * descripción libre que escribió la entidad (contenido ajeno: tal cual).
 * Un tipo desconocido cae al valor crudo.
 */
export function trackingTypeText(type: string, label: string, t: Translate): string {
  const key = trackingTypeKey(type);
  const name = key ? t(key) : type;
  return label ? t("entidad.seguimiento.typeWithLabel", { type: name, label }) : name;
}

/** Texto de un valor con clave o, si el panel no lo conoce, el valor crudo (`—` si no hay). */
export function labelOrRaw(key: string | null, raw: string | null | undefined, t: Translate): string {
  if (key) return t(key);
  return raw || "—";
}

/**
 * Casillas del check-in que el referente puede ver (`SharedCheckin`, sin
 * `note`, que nunca se comparte), en el orden de la app, con su clave.
 */
export const CHECKIN_FLAGS = [
  ["main_goal", "tracking.flags.mainGoal"],
  ["sport", "tracking.flags.sport"],
  ["went_out", "tracking.flags.wentOut"],
  ["met_someone", "tracking.flags.metSomeone"],
  ["popyplan_plan", "tracking.flags.popyplanPlan"],
  ["slept_well", "tracking.flags.sleptWell"],
  ["routine", "tracking.flags.routine"],
  ["therapy_meeting", "tracking.flags.therapyMeeting"],
  ["feel_good", "tracking.flags.feelGood"],
] as const;
