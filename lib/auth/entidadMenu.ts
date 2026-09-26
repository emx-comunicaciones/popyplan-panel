/**
 * Menú lateral del panel de entidad y su visibilidad por rol (constraint
 * «Entorno panel web» y decisiones de la tarea W1). Las 13 secciones del
 * brief original (14 desde que la tarea W3 de la Fase 6 añade Programas,
 * ver más abajo); qué ve cada rol sale de la matriz `entities/permissions.py`
 * y de las reglas explícitas de la tarea:
 * - `titular`/`moderador`: todo.
 * - `dinamizador`: todo salvo Configuración, Reportes, Comunicaciones,
 *   Informes, Personas y Guardia (las dos últimas, desde la auditoría de
 *   2026-09-21 — ver más abajo).
 * - `analista`: solo Inicio, Programas e Informes (nunca lista nominal).
 * - `referente`: solo Inicio, Personas, Actividades y Programas (sus personas asignadas).
 * - «Programa de seguimiento» (2026-09-26): solo `titular`/`moderador` y
 *   solo con `trackingEnabled` (ver `EntidadMenuContext`).
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
 *
 * Bloque 1 de territorio (spec §4.5): «Recursos» pasa a llamarse
 * «Biblioteca» en toda la interfaz y su ruta es
 * `/entidad/[slug]/biblioteca` (la vieja redirige con 308, ver
 * `lib/config/redirects.ts`). El nombre de la API no cambia
 * (`/api/panel/entidad/{id}/resources/`), ni el del componente
 * (`components/entidad/RecursosPanel.tsx`), ni el namespace de catálogo
 * `entidad.recursos.*`: solo el nombre visible y la ruta.
 *
 * **Auditoría de integración (2026-09-21), hallazgos A-I3 y D-I8** — el
 * menú ofrecía dos secciones que el backend le niega al `dinamizador`, y
 * escondía una que el backend sí autoriza:
 * - **Personas** sale del menú de `dinamizador`: `GET /api/panel/entidad/
 *   {id}/people/` exige `ver_lista_nominal` **y** además un rol de
 *   `panel/viewsets.py::ROLES_LISTA_PERSONAS` (`titular`/`moderador`/
 *   `referente`), y la ficha exige `ver_ficha`
 *   (`entities/permissions.py`, los mismos tres). El `dinamizador`
 *   recibía 403 en la lista y en cada ficha.
 * - **Guardia** sale también de su menú: `safety/viewsets.py
 *   ::HelpRequestViewSet.pending` acepta `es_guardia or puede(user, org,
 *   'moderar')`, y `'moderar'` es `{titular, moderador}`.
 * - …pero **cualquier** `OrgMembership` puede ser la persona de guardia
 *   (`Organization.on_call_user`, validado en `entities/serializers.py`),
 *   así que una `analista`, `referente` o `dinamizador` nombrada guardia
 *   recibe los avisos y necesita la sección. De ahí el segundo argumento
 *   de `entidadMenuFor`: `{ isOnCall }`, que el Server Component calcula
 *   comparando `organization.on_call_user` con `session.me.id`. Es la
 *   única parte del menú que no depende solo del rol, porque en el
 *   backend tampoco depende solo del rol.
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
  "biblioteca",
  "familias",
  "programas",
  "seguimiento",
  "reportes",
  "guardia",
  "informes",
  "configuracion",
] as const;

export type EntidadMenuItem = (typeof ENTIDAD_MENU_ITEMS)[number];

/**
 * Claves de traducción de cada sección (tarea i18n 2), no el texto en
 * español: `app/entidad/[slug]/layout.tsx` (Server Component) resuelve
 * `t(ENTIDAD_MENU_LABELS[item])` con `getTranslations()`. Es el mapa
 * explícito que permite la regla «sin claves dinámicas construidas
 * salvo un `Record` con todas las variantes» — las claves reales viven
 * en `messages/*.json::menu.entidad.*`.
 */
export const ENTIDAD_MENU_LABELS: Record<EntidadMenuItem, string> = {
  inicio: "menu.entidad.inicio",
  personas: "menu.entidad.personas",
  comunidades: "menu.entidad.comunidades",
  actividades: "menu.entidad.actividades",
  asistencia: "menu.entidad.asistencia",
  comunicaciones: "menu.entidad.comunicaciones",
  encuestas: "menu.entidad.encuestas",
  biblioteca: "menu.entidad.biblioteca",
  familias: "menu.entidad.familias",
  programas: "menu.entidad.programas",
  seguimiento: "menu.entidad.seguimiento",
  reportes: "menu.entidad.reportes",
  guardia: "menu.entidad.guardia",
  informes: "menu.entidad.informes",
  configuracion: "menu.entidad.configuracion",
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
  // A-I3: `people/` y la ficha son de `titular`/`moderador`/`referente`.
  "personas",
  // D-I8: `help-requests/pending/` pide `moderar` o ser la guardia; el
  // segundo caso lo cubre `isOnCall`, no el rol.
  "guardia",
  // Programa de seguimiento: `gestionar_seguimiento` es solo
  // titular/moderador (y el backend responde 404 a cualquier otro).
  "seguimiento",
  ...PENDING_SECTIONS,
];
const ANALISTA_VISIBLE: readonly EntidadMenuItem[] = ["inicio", "programas", "informes"];
const REFERENTE_VISIBLE: readonly EntidadMenuItem[] = [
  "inicio",
  "personas",
  "actividades",
  "programas",
];

/**
 * Lo que el menú necesita saber de la entidad además del rol. Hoy solo
 * `isOnCall` (`organization.on_call_user === session.me.id`): el backend
 * deja ver los avisos de ayuda a la persona de guardia **sea cual sea su
 * rol**, así que sin esto una `referente` o una `analista` nombrada
 * guardia recibía los avisos por API sin tener pantalla donde verlos.
 */
export interface EntidadMenuContext {
  isOnCall?: boolean;
  /**
   * `organization.tracking_program_enabled` (programa de seguimiento,
   * `docs/PANEL.md` §18.3): la sección «Programa de seguimiento» solo
   * existe para titular/moderador de una entidad con el servicio
   * encendido. Sin el servicio, ni siquiera ellos la ven; y ningún otro
   * rol la ve nunca — el menú no puede revelar que el programa existe a
   * quien el backend le responde 404.
   */
  trackingEnabled?: boolean;
}

export function entidadMenuFor(
  role: EntidadPanelRole | string,
  context: EntidadMenuContext = {},
): EntidadMenuItem[] {
  const byRole = context.trackingEnabled
    ? menuByRole(role)
    : menuByRole(role).filter((item) => item !== "seguimiento");
  // `byRole.length === 0` es «este rol no tiene panel» (no está en
  // `ver_panel`): ser la guardia no le abre una sección suelta, porque el
  // layout de entidad ya lo devuelve a la raíz antes de llegar aquí.
  if (!context.isOnCall || byRole.length === 0 || byRole.includes("guardia")) return byRole;
  // Se reconstruye filtrando `ENTIDAD_MENU_ITEMS` para que «Guardia»
  // caiga en su sitio del menú, no al final.
  const visible = new Set<EntidadMenuItem>([...byRole, "guardia"]);
  return ENTIDAD_MENU_ITEMS.filter((item) => visible.has(item));
}

function menuByRole(role: EntidadPanelRole | string): EntidadMenuItem[] {
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
