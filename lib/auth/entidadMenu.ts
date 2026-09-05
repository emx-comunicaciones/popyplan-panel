/**
 * Menú lateral del panel de entidad y su visibilidad por rol (constraint
 * «Entorno panel web» y decisiones de la tarea W1). Las 13 secciones del
 * brief; qué ve cada rol sale de la matriz `entities/permissions.py` y de
 * las reglas explícitas de la tarea:
 * - `titular`/`moderador`: todo.
 * - `dinamizador`: todo salvo Configuración, Reportes y Comunicaciones.
 * - `analista`: solo Inicio e Informes (nunca lista nominal).
 * - `referente`: solo Inicio, Personas y Actividades (sus personas asignadas).
 *
 * Tarea W4a: Comunicaciones, Encuestas, Recursos y Familias todavía no
 * tienen página real (llegan en W4b) — para que no den 404, se ocultan
 * también del menú de `dinamizador` (que si no las vería, igual que
 * `analista`/`referente` ya las excluían) y sus `page.tsx` de
 * `titular`/`moderador` (que sí las conservan en el menú) pintan un aviso
 * «Próximamente» en vez de la función real.
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

/**
 * Secciones sin página real todavía (W4b): se ocultan igual que
 * Configuración/Reportes/Comunicaciones para `dinamizador`, que si no
 * llegaría a una de estas cuatro por el menú.
 */
export const PENDING_SECTIONS: readonly EntidadMenuItem[] = [
  "comunicaciones",
  "encuestas",
  "recursos",
  "familias",
];

const DINAMIZADOR_HIDDEN: readonly EntidadMenuItem[] = [
  "configuracion",
  "reportes",
  ...PENDING_SECTIONS,
];
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
