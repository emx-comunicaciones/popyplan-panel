/**
 * Endpoints del backend consumidos por el panel, centralizados como en
 * `popyplan-mobile/app/_constants/urls.ts`. `lib/api/__tests__/consumption.test.ts`
 * exige que todo endpoint aquí declarado se use en el código y tenga test
 * (o conste en `consumption-allowlist.json`, que solo puede encoger).
 *
 * W1 consumía solo login, sesión propia, rol de plataforma y la ficha de
 * una entidad. W2 añadió las rutas de métricas y exportación
 * (`docs/PANEL.md` §1-§2). W3 añade el refresh real de sesión (§0),
 * personas/actividades de la entidad (§3), asistencia y check-in por QR
 * (§4, en `events`) y referentes (`SEGURIDAD_Y_MODERACION.md` §8/§5).
 */

export const AUTH = {
  /** `POST /api/auth/login/` (`users/auth_viewsets.py::AuthViewSet.login`). */
  LOGIN: "/api/auth/login/",
  /**
   * `POST /api/auth/token/refresh/` (`docs/PANEL.md` §0): `{refresh}` →
   * `{access, refresh}` (rotado, `ROTATE_REFRESH_TOKENS=True`). El
   * `refresh` anterior queda en lista negra al primer uso del nuevo.
   */
  TOKEN_REFRESH: "/api/auth/token/refresh/",
  /**
   * `POST /api/auth/logout/ {refresh}` invalida explícitamente el
   * refresh token al cerrar sesión (`docs/PANEL.md` §0).
   */
  LOGOUT: "/api/auth/logout/",
} as const;

export const USERS = {
  /** `GET /api/users/users/me/`. */
  ME: "/api/users/users/me/",
} as const;

export const SAFETY = {
  /** `GET /api/safety/platform-roles/me/`. */
  PLATFORM_ROLE_ME: "/api/safety/platform-roles/me/",
  /**
   * `GET /api/safety/reports/queue/?organization=<id>&status=` — paginada
   * (`docs/SEGURIDAD_Y_MODERACION.md` §4). El Inicio de la entidad solo
   * usa `.count` (reportes pendientes) sin listar filas; `reportes/page.tsx`
   * (tarea W4a) sí lista.
   */
  REPORTS_QUEUE: () => "/api/safety/reports/queue/",
  /** `GET /api/safety/reports/{id}/` (§4): detalle con `target`. */
  REPORT_DETAIL: (id: string) => `/api/safety/reports/${id}/`,
  /** `POST /api/safety/reports/{id}/assign/` (§4). */
  REPORT_ASSIGN: (id: string) => `/api/safety/reports/${id}/assign/`,
  /** `POST /api/safety/reports/{id}/resolve/ {resolution, note?}` (§4). */
  REPORT_RESOLVE: (id: string) => `/api/safety/reports/${id}/resolve/`,
  /** `POST /api/safety/reports/{id}/escalate/ {note?}` (§4). */
  REPORT_ESCALATE: (id: string) => `/api/safety/reports/${id}/escalate/`,
  /**
   * `GET /api/safety/help-requests/pending/?organization=<id>` — paginada
   * (`docs/SEGURIDAD_Y_MODERACION.md` §5).
   */
  HELP_REQUESTS_PENDING: () => "/api/safety/help-requests/pending/",
  /** `POST /api/safety/help-requests/{id}/acknowledge/` (§5): «He contactado». */
  HELP_REQUEST_ACKNOWLEDGE: (id: string) => `/api/safety/help-requests/${id}/acknowledge/`,
} as const;

export const ORGANIZATIONS = {
  /** `GET`/`PATCH /api/organizations/{id}/`. */
  DETAIL: (id: number | string) => `/api/organizations/${id}/`,
  /**
   * `GET`/`POST`/`DELETE /api/organizations/{id}/references/`
   * (`docs/SEGURIDAD_Y_MODERACION.md` §8): persona ↔ referente.
   */
  REFERENCES: (id: number | string) => `/api/organizations/${id}/references/`,
  /**
   * `GET`/`POST`/`DELETE /api/organizations/{id}/members/` (§8): equipo
   * de la entidad (solo `titular`, permiso `equipo`).
   */
  MEMBERS: (id: number | string) => `/api/organizations/${id}/members/`,
  /**
   * `POST /api/organizations/{id}/scope/ {places}|{province}|{comarca}`
   * (§8): amplía el ámbito INE de la entidad.
   */
  SCOPE: (id: number | string) => `/api/organizations/${id}/scope/`,
} as const;

/**
 * `docs/SEGURIDAD_Y_MODERACION.md` §8 (comunidades ya existía para móvil,
 * el panel de entidad la reutiliza en la tarea W4a): API de `communities`,
 * no de `panel`. `docs/schema.yaml` documenta mal la forma de la mayoría
 * de estas respuestas (dice `Community` completa); la real es
 * `CommunityMemberSerializer` — ver `lib/api/types.ts::CommunityMember`.
 */
export const COMMUNITIES = {
  /**
   * `GET /api/communities/?search=&page=` — paginada, sin filtro por
   * entidad en el backend: `hooks/useEntityCommunities.ts` recorre las
   * páginas y filtra por `owner.id` en el cliente (ver el hueco
   * documentado en `lib/api/types.ts::EntityCommunityRow`).
   */
  LIST: () => "/api/communities/",
  /** `GET /api/communities/{id}/members/` — miembros activos. */
  MEMBERS: (id: string) => `/api/communities/${id}/members/`,
  /** `GET /api/communities/{id}/pending-requests/` — solicitudes pendientes. */
  PENDING_REQUESTS: (id: string) => `/api/communities/${id}/pending-requests/`,
  /** `POST /api/communities/{id}/members/{memberId}/approve/`. */
  APPROVE_MEMBER: (id: string, memberId: string) =>
    `/api/communities/${id}/members/${memberId}/approve/`,
  /** `POST /api/communities/{id}/members/{memberId}/reject/`. */
  REJECT_MEMBER: (id: string, memberId: string) =>
    `/api/communities/${id}/members/${memberId}/reject/`,
  /** `POST /api/communities/{id}/members/{memberId}/kick/`. */
  KICK_MEMBER: (id: string, memberId: string) =>
    `/api/communities/${id}/members/${memberId}/kick/`,
  /** `PATCH /api/communities/{id}/members/{memberId}/role/ {role}`. */
  MEMBER_ROLE: (id: string, memberId: string) =>
    `/api/communities/${id}/members/${memberId}/role/`,
} as const;

/**
 * `docs/PANEL.md` §3 («Personas y actividades»). `?since&until&…` los
 * añade quien llama (`hooks/usePeople.ts`, `hooks/useEntityEvents.ts`).
 */
export const PANEL = {
  /** `GET /api/panel/entidad/{org_id}/people/`. */
  PEOPLE: (orgId: number | string) => `/api/panel/entidad/${orgId}/people/`,
  /** `GET /api/panel/entidad/{org_id}/people/{user_id}/`. */
  PERSON: (orgId: number | string, userId: number | string) =>
    `/api/panel/entidad/${orgId}/people/${userId}/`,
  /** `GET /api/panel/entidad/{org_id}/events/`. */
  EVENTS: (orgId: number | string) => `/api/panel/entidad/${orgId}/events/`,
} as const;

/**
 * `docs/PANEL.md` §4 («Asistencia por QR») y `events/viewsets.py`
 * (asistencia manual, ya existente en `events`, ver `docs/schema.yaml`).
 */
export const EVENTS = {
  /** `GET /api/events/{id}/attendees/` — lista nominal, solo organizador. */
  ATTENDEES: (id: string) => `/api/events/${id}/attendees/`,
  /** `POST /api/events/{id}/attendance/ {user_id, attended}`. */
  ATTENDANCE: (id: string) => `/api/events/${id}/attendance/`,
  /** `POST /api/events/{id}/checkin/ {token}`. */
  CHECKIN: (id: string) => `/api/events/${id}/checkin/`,
} as const;

/**
 * `docs/PANEL.md` §1. `?since&until&group_by` los añade quien llama
 * (`hooks/useMetrics.ts`), nunca aquí: estas funciones solo devuelven la
 * ruta base.
 */
export const METRICS = {
  /** `GET /api/panel/entidad/{org_id}/metrics/`. */
  ENTIDAD: (orgId: number | string) => `/api/panel/entidad/${orgId}/metrics/`,
  /** `GET /api/panel/paraguas/{org_id}/metrics/`. */
  PARAGUAS: (orgId: number | string) => `/api/panel/paraguas/${orgId}/metrics/`,
  /** `GET /api/panel/plataforma/metrics/`. */
  PLATAFORMA: () => `/api/panel/plataforma/metrics/`,
} as const;

/** Exportación de informes (CSV/PDF), `docs/PANEL.md` §2. */
export const EXPORT = {
  /** `GET /api/panel/entidad/{org_id}/export/?format=csv|pdf&since&until&group_by`. */
  ENTIDAD: (orgId: number | string) => `/api/panel/entidad/${orgId}/export/`,
  /** `GET /api/panel/paraguas/{org_id}/export/?format=csv|pdf&since&until&group_by`. */
  PARAGUAS: (orgId: number | string) => `/api/panel/paraguas/${orgId}/export/`,
  /** `GET /api/panel/plataforma/export/?format=csv|pdf&since&until&group_by`. */
  PLATAFORMA: () => `/api/panel/plataforma/export/`,
} as const;
