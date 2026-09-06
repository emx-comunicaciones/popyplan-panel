/**
 * Menú lateral del panel de entidad y su visibilidad por rol (constraint
 * «Entorno panel web» y decisiones de la tarea W1). Las 13 secciones del
 * brief original (14 desde que la tarea W3 de la Fase 6 añade Programas,
 * ver más abajo); qué ve cada rol sale de la matriz `entities/permissions.py`
 * y de las reglas explícitas de la tarea:
 * - `titular`/`moderador`: todo.
 * - `dinamizador`: todo salvo Configuración, Reportes y Comunicaciones.
 * - `analista`: solo Inicio, Programas e Informes (nunca lista nominal).
 * - `referente`: solo Inicio, Personas, Actividades y Programas (sus personas asignadas).
 *
 * Tarea W4a: Comunicaciones, Encuestas, Recursos y Familias todavía no
 * tenían página real — para que no dieran 404, se ocultaban también del
 * menú de `dinamizador` (además de Configuración/Reportes) mientras sus
 * `page.tsx` pintaban «Próximamente».
 *
 * Tarea W4b: Comunicaciones, Encuestas y Recursos ya tienen página real
 * (Familias sigue aparcada hasta P6). Se restaura la matriz original de
 * `dinamizador` de arriba: recupera Encuestas y Recursos en su menú (el
 * docstring original nunca las excluía, solo el parche temporal de W4a lo
 * hacía); Comunicaciones sigue oculta para `dinamizador` porque el
 * docstring sí la excluye explícitamente («todo salvo... Comunicaciones»)
 * — coincide además con el contrato: `POST` solo admite titular/moderador,
 * y `dinamizador` no tiene otra acción que hacer en esa página. Familias
 * se queda en `PENDING_SECTIONS` (sin página real todavía).
 *
 * Tarea W6 (carry-over): Informes ya tiene página real
 * (`app/entidad/[slug]/informes/page.tsx`), pero solo exporta quien
 * puede exportar informes en el backend (`PuedeEnEntidad
 * ('exportar_informes')`, `docs/PANEL.md` §2.1): `titular`, `moderador`
 * y `analista` — nunca `dinamizador` ni `referente`. `dinamizador`
 * pasaba por `ENTIDAD_MENU_ITEMS` sin excluirla (no estaba construida
 * todavía); se añade a `DINAMIZADOR_HIDDEN` para que no ofrezca una
 * sección que el backend le rechazaría con 403.
 *
 * Ronda final de Fase 5 (backend P6 cerrado): Familias ya tiene página
 * real (`app/entidad/[slug]/familias/page.tsx`, `docs/PANEL.md` §8) —
 * sale de `PENDING_SECTIONS` y `dinamizador` recupera su matriz original
 * de arriba («todo salvo Configuración, Reportes y Comunicaciones»,
 * que nunca excluía Familias). Igual que Comunidades, la página no gatea
 * por rol en el cliente más allá de `canManage` (titular/moderador,
 * comprobado por `FamiliasPanel` para el interruptor de cruce de
 * espacios y «Nueva comunidad de familias»): `dinamizador` la ve en modo
 * solo lectura, sin que el backend necesite un permiso de escritura
 * específico para él (`PuedeEnEntidad('ver_panel')` ya lo cubre, §8.3).
 *
 * Tarea W3 de la Fase 6 (`docs/PANEL.md` §12, «Programas»): sección nueva,
 * visible para los cinco roles de entidad (el backend solo pide
 * `ver_panel` para leer, igual que Inicio) — a diferencia de Informes,
 * que exige además `exportar_informes` y por eso queda fuera de
 * `analista`/`referente`. Gestionar (crear/editar/activar/cerrar) sigue
 * acotado a `titular`/`moderador` (`gestionar_programas`), comprobado por
 * `ProgramasPanel`/`ProgramaDetalle` (`canManage`), igual patrón que
 * Familias/Recursos/Comunicaciones.
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
  "programas",
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
  programas: "Programas",
  reportes: "Reportes",
  guardia: "Guardia",
  informes: "Informes",
  configuracion: "Configuración",
};

/**
 * Secciones sin página real todavía: ninguna (Familias, la última que
 * quedaba, ya tiene página real desde el cierre de P6 en el backend —
 * ver el docstring de arriba). Se mantiene la lista (vacía) en vez de
 * borrarla para que quien añada una sección nueva sin página real
 * todavía tenga un sitio obvio donde anotarla.
 */
export const PENDING_SECTIONS: readonly EntidadMenuItem[] = [];

const DINAMIZADOR_HIDDEN: readonly EntidadMenuItem[] = [
  "configuracion",
  "reportes",
  "comunicaciones",
  "informes",
  ...PENDING_SECTIONS,
];
const ANALISTA_VISIBLE: readonly EntidadMenuItem[] = ["inicio", "programas", "informes"];
const REFERENTE_VISIBLE: readonly EntidadMenuItem[] = [
  "inicio",
  "personas",
  "actividades",
  "programas",
];

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
