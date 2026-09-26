/**
 * Nivel de una actividad (`events.Event.level`, `docs/PANEL.md` §17.6 del
 * backend): opcional, `""` = todos los niveles. Las etiquetas viven en los
 * catálogos (`events.levels.*`); aquí solo los valores y sus claves.
 */
import type { EventLevel } from "@/lib/api/types";

export const EVENT_LEVELS: readonly EventLevel[] = ["", "beginner", "intermediate", "advanced"];

const LEVEL_LABEL_KEYS: Record<string, string> = {
  "": "events.levels.all",
  beginner: "events.levels.beginner",
  intermediate: "events.levels.intermediate",
  advanced: "events.levels.advanced",
};

/**
 * Clave de catálogo de un nivel; `null` si el backend manda un valor que el
 * panel no conoce (quien llama pinta el valor crudo). `null`/`undefined`
 * (un detalle sin el campo) cuentan como «todos los niveles».
 */
export function levelLabelKey(level: string | null | undefined): string | null {
  return LEVEL_LABEL_KEYS[level ?? ""] ?? null;
}

/** Normaliza lo que llega del backend a un valor del `<select>`. */
export function toEventLevel(level: string | null | undefined): EventLevel {
  return (EVENT_LEVELS as readonly string[]).includes(level ?? "") ? ((level ?? "") as EventLevel) : "";
}
