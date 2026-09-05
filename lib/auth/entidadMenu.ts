/**
 * Menú lateral del panel de entidad y su visibilidad por rol (constraint
 * «Entorno panel web» y decisiones de la tarea W1). Las 13 secciones del
 * brief; qué ve cada rol sale de la matriz `entities/permissions.py` y de
 * las reglas explícitas de la tarea:
 * - `titular`/`moderador`: todo.
 * - `dinamizador`: todo salvo Configuración, Reportes y Comunicaciones.
 * - `analista`: solo Inicio e Informes (nunca lista nominal).
 * - `referente`: solo Inicio, Personas y Actividades (sus personas asignadas).
 */
import type { EntidadPanelRole } from "./area";

export const ENTIDAD_MENU_ITEMS = [
  "inicio",
  "personas",
  "comunidades",
  "actividades",
  "asistencia",
  "comunicaciones",
  "encuestas",
  "recursos",
  "familias",
  "reportes",
  "guardia",
  "informes",
  "configuracion",
] as const;

export type EntidadMenuItem = (typeof ENTIDAD_MENU_ITEMS)[number];

export const ENTIDAD_MENU_LABELS: Record<EntidadMenuItem, string> = {
  inicio: "Inicio",
  personas: "Personas",
  comunidades: "Comunidades",
  actividades: "Actividades",
  asistencia: "Asistencia",
  comunicaciones: "Comunicaciones",
  encuestas: "Encuestas",
  recursos: "Recursos",
  familias: "Familias",
  reportes: "Reportes",
  guardia: "Guardia",
  informes: "Informes",
  configuracion: "Configuración",
};

const DINAMIZADOR_HIDDEN: readonly EntidadMenuItem[] = ["configuracion", "reportes", "comunicaciones"];
const ANALISTA_VISIBLE: readonly EntidadMenuItem[] = ["inicio", "informes"];
const REFERENTE_VISIBLE: readonly EntidadMenuItem[] = ["inicio", "personas", "actividades"];

export function entidadMenuFor(role: EntidadPanelRole | string): EntidadMenuItem[] {
  switch (role) {
    case "titular":
    case "moderador":
      return [...ENTIDAD_MENU_ITEMS];
    case "dinamizador":
      return ENTIDAD_MENU_ITEMS.filter((item) => !DINAMIZADOR_HIDDEN.includes(item));
    case "analista":
      return [...ANALISTA_VISIBLE];
    case "referente":
      return [...REFERENTE_VISIBLE];
    default:
      return [];
  }
}
