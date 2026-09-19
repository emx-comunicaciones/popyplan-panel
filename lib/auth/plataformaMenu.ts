/**
 * Menú lateral del panel de plataforma (decisión «Panel de plataforma»,
 * plan de Fase 5). W1 lo dejó igual para los cuatro roles de
 * `safety.PlatformRole` (`superadmin`, `verifier`, `moderator`,
 * `support`), a la espera de que las páginas reales (P5-P7 backend, W5
 * panel) decidieran qué puede *usar* cada uno.
 *
 * Tarea W5: matriz real, sacada del permiso de cada endpoint
 * (`docs/SEGURIDAD_Y_MODERACION.md` y `docs/PANEL.md`):
 * - **`superadmin`**: todo.
 * - **`verifier`**: Inicio, Entidades (alta/verificar) y Verificaciones
 *   (`organization-list/create/verify` y
 *   `verification-review-queue/decide` piden
 *   `HasPlatformRole('verifier', 'superadmin')`); nunca Reportes/Ayuda
 *   (`safety/services/reports.py::queue` exige
 *   `moderator`/`superadmin`/`support`, sin `verifier`), nunca Métricas
 *   (`PlataformaMetricsView` exige `superadmin`/`moderator`/`support`,
 *   sin `verifier` — pregunta 7 del informe de W2, ya detectada) ni
 *   Roles/Auditoría (solo `superadmin`).
 * - **`moderator`**: Inicio, Reportes, Ayuda y Métricas (mismo permiso
 *   que arriba); nunca Entidades/Verificaciones (solo
 *   `verifier`/`superadmin`) ni Roles/Auditoría (solo `superadmin`).
 * - **`support`**: Inicio, Reportes y Ayuda, pero solo lectura (`safety/
 *   services/reports.py::can_view` lo admite en la cola/detalle, `can_act`
 *   no: sin asignar/resolver/escalar; en Ayuda no es guardia de ninguna
 *   entidad salvo que también tenga membresía, así que la lista casi
 *   siempre queda vacía — el permiso de la página no depende de eso).
 *   También Métricas (mismo permiso que `moderator`). Nunca
 *   Entidades/Verificaciones/Roles/Auditoría.
 *
 * Tarea W4 (Fase 6, `docs/PANEL.md` §13): **Contratos** se añade para
 * `superadmin` y `support` (`HasPlatformRole('superadmin', 'support')`
 * en las ocho rutas de `billing`, lectura para los dos; la escritura la
 * acota el propio `ContratosPanel.tsx`, no el menú). `moderator` y
 * `verifier` no la ven: ninguno de los dos tiene lectura de facturación.
 */
export const PLATAFORMA_MENU_ITEMS = [
  "inicio",
  "entidades",
  "reportes",
  "ayuda",
  "verificaciones",
  "roles",
  "auditoria",
  "metricas",
  "contratos",
] as const;

export type PlataformaMenuItem = (typeof PLATAFORMA_MENU_ITEMS)[number];

/**
 * Claves de traducción de cada sección (tarea i18n 2), no el texto en
 * español: `app/plataforma/layout.tsx` (Server Component) resuelve
 * `t(PLATAFORMA_MENU_LABELS[item])` con `getTranslations()`. Mismo
 * patrón que `lib/auth/entidadMenu.ts::ENTIDAD_MENU_LABELS` — las
 * claves reales viven en `messages/*.json::menu.plataforma.*`.
 */
export const PLATAFORMA_MENU_LABELS: Record<PlataformaMenuItem, string> = {
  inicio: "menu.plataforma.inicio",
  entidades: "menu.plataforma.entidades",
  reportes: "menu.plataforma.reportes",
  ayuda: "menu.plataforma.ayuda",
  verificaciones: "menu.plataforma.verificaciones",
  roles: "menu.plataforma.roles",
  auditoria: "menu.plataforma.auditoria",
  metricas: "menu.plataforma.metricas",
  contratos: "menu.plataforma.contratos",
};

/**
 * Los cuatro roles de `safety.PlatformRole`. `GET
 * /api/safety/platform-roles/me/` devuelve `{role: string|null}` —una
 * cadena libre para el tipo, no una enumeración—, así que un rol que el
 * backend añada (o un dato corrupto) llegaría aquí sin ser ninguno de
 * los cuatro: `plataformaMenuFor` le devuelve un menú vacío y quien lo
 * tenga se quedaría en un panel sin ninguna sección (hallazgo B20). El
 * layout de plataforma lo trata como «sin rol» y manda a la raíz, que ya
 * decide el área real.
 */
export const PLATFORM_ROLES = ["superadmin", "verifier", "moderator", "support"] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export function isPlatformRole(role: string | null | undefined): role is PlatformRole {
  return !!role && (PLATFORM_ROLES as readonly string[]).includes(role);
}

/**
 * Roles de plataforma que el backend deja gestionar el equipo de una
 * entidad sin tener membresía propia en ella (`panel/permissions.py
 * ::PuedeEnEntidad`, atajo de la tarea P7, `docs/PANEL.md` §10.2):
 * `superadmin` y `moderator` pasan la comprobación `equipo`; `support`
 * solo `ver_panel` y `verifier` nada. `EntidadDetail.tsx` esconde con
 * esta lista los formularios y el botón «Quitar» de la pestaña Equipo:
 * un `verifier` los veía y recibía un 403 al usarlos.
 */
export const TEAM_MANAGER_ROLES = ["superadmin", "moderator"] as const;

export function canManageTeamFromPlatform(role: string | null | undefined): boolean {
  return !!role && (TEAM_MANAGER_ROLES as readonly string[]).includes(role);
}

const VERIFIER_VISIBLE: readonly PlataformaMenuItem[] = ["inicio", "entidades", "verificaciones"];
const MODERATOR_VISIBLE: readonly PlataformaMenuItem[] = ["inicio", "reportes", "ayuda", "metricas"];
const SUPPORT_VISIBLE: readonly PlataformaMenuItem[] = [
  "inicio",
  "reportes",
  "ayuda",
  "metricas",
  "contratos",
];

export function plataformaMenuFor(role: string | null | undefined): PlataformaMenuItem[] {
  switch (role) {
    case "superadmin":
      return [...PLATAFORMA_MENU_ITEMS];
    case "verifier":
      return [...VERIFIER_VISIBLE];
    case "moderator":
      return [...MODERATOR_VISIBLE];
    case "support":
      return [...SUPPORT_VISIBLE];
    default:
      return [];
  }
}
