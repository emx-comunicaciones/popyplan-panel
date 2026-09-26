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
 *
 * Bloque 1 de territorio (spec §4.5): la sección pasa a llamarse
 * «Suscripciones» y su ruta a `/plataforma/suscripciones` (la vieja
 * redirige con 308, ver `lib/config/redirects.ts`). El objeto de dominio
 * sigue siendo `Contract` (app `billing`, sin cambios de API): la
 * pestaña «Contratos» de dentro del panel (`ContratosPanel.tsx`) no se
 * toca, solo el nombre visible de la sección y su ruta.
 *
 * Admin de plataforma, bloque 1 (2026-09-26): **Usuarios** y
 * **Bloqueos**, solo `superadmin`. Usuarios usa `GET /api/users/users/`,
 * `POST /api/auth/admin-register/` y `PATCH`/`DELETE /api/users/{id}/`,
 * todos `IsAdminUser` (`is_staff`, que hoy solo tiene `superadmin`; mismo
 * razonamiento que `dashboard-stats`). Bloqueos admitiría también
 * `moderator` (`HasPlatformRole('moderator', 'superadmin')`), pero elegir
 * la cuenta pasa por el mismo buscador `is_staff`, así que para un
 * moderador la pantalla no tendría puerta de entrada.
 *
 * Admin de plataforma, bloque 3 (2026-09-26): **Comunidades**,
 * **Actividades**, **Reseñas**, **Chats**, **Notificaciones** y
 * **Nomencladores**, solo `superadmin`. Todas sus rutas
 * (`/api/communities/`, `/api/community-posts/`, `/api/events/`,
 * `/api/reviews/`, `/api/admin/chats/`, `/api/notifications/send/`,
 * `/api/notification-templates/` y los catálogos) conceden el acceso
 * amplio por `is_staff` —`IsAdminUser` o un `user.is_staff` en el
 * código—, nunca por `PlatformRole`; y `is_staff` hoy solo lo tiene
 * `superadmin`.
 *
 * Admin de plataforma, bloque 2 (2026-09-26): **Búsqueda del tesoro**
 * (`/plataforma/busca-del-tesoro`), solo `superadmin`: el backend exige
 * `is_staff` o `PlatformRole` superadmin
 * (`treasure_hunt/permissions.py::es_gestor_de_juegos`) y cualquier otro
 * rol de plataforma recibe 403.
 */
export const PLATAFORMA_MENU_ITEMS = [
  "inicio",
  "entidades",
  "usuarios",
  "comunidades",
  "actividades",
  "reportes",
  "bloqueos",
  "resenas",
  "chats",
  "notificaciones",
  "ayuda",
  "verificaciones",
  "roles",
  "auditoria",
  "metricas",
  "suscripciones",
  "nomencladores",
  "busca-del-tesoro",
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
  usuarios: "menu.plataforma.usuarios",
  comunidades: "menu.plataforma.comunidades",
  actividades: "menu.plataforma.actividades",
  reportes: "menu.plataforma.reportes",
  bloqueos: "menu.plataforma.bloqueos",
  resenas: "menu.plataforma.resenas",
  chats: "menu.plataforma.chats",
  notificaciones: "menu.plataforma.notificaciones",
  ayuda: "menu.plataforma.ayuda",
  verificaciones: "menu.plataforma.verificaciones",
  roles: "menu.plataforma.roles",
  auditoria: "menu.plataforma.auditoria",
  metricas: "menu.plataforma.metricas",
  suscripciones: "menu.plataforma.suscripciones",
  nomencladores: "menu.plataforma.nomencladores",
  "busca-del-tesoro": "menu.plataforma.buscaDelTesoro",
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
  "suscripciones",
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
