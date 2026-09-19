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
  /**
   * `GET /api/users/users/?search=` (`users/unified_viewset.py::list_users`):
   * listado de cuentas, `IsAdminUser` (solo `is_staff`, que hoy solo tiene
   * `superadmin` — `docs/SEGURIDAD_Y_MODERACION.md` §1). Lo usa
   * `roles/page.tsx` para buscar a quién conceder un rol de plataforma;
   * un 403 (rol de plataforma sin `is_staff`, aunque hoy solo `superadmin`
   * llega a esta página) se traduce a «sin buscador», cayendo al id a
   * mano.
   */
  SEARCH: () => "/api/users/users/",
} as const;

export const SAFETY = {
  /** `GET /api/safety/platform-roles/me/`. */
  PLATFORM_ROLE_ME: "/api/safety/platform-roles/me/",
  /**
   * `GET /api/safety/reports/queue/?organization=<id>&status=` — **array
   * plano, no paginada** (`docs/SEGURIDAD_Y_MODERACION.md` §4:
   * `ReportViewSet.queue` devuelve una lista 200 sin paginador — el
   * esquema lo envuelve como `PaginatedReportList` por el
   * `pagination_class` del ViewSet, pero la acción nunca pagina; bug real
   * encontrado por el e2e de W6). El Inicio de la entidad solo cuenta
   * `.length` (reportes pendientes) sin listar filas;
   * `reportes/page.tsx` (tarea W4a) sí lista.
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
   * `GET /api/safety/help-requests/pending/?organization=<id>` — **array
   * plano, no paginada** (`docs/SEGURIDAD_Y_MODERACION.md` §5, mismo
   * mismatch esquema/realidad que `REPORTS_QUEUE`: la acción devuelve una
   * lista 200 sin paginar).
   */
  HELP_REQUESTS_PENDING: () => "/api/safety/help-requests/pending/",
  /** `POST /api/safety/help-requests/{id}/acknowledge/` (§5): «He contactado». */
  HELP_REQUEST_ACKNOWLEDGE: (id: string) => `/api/safety/help-requests/${id}/acknowledge/`,
  /**
   * `GET`/`POST /api/safety/platform-roles/` y
   * `DELETE /api/safety/platform-roles/{user_id}/`
   * (`docs/SEGURIDAD_Y_MODERACION.md` §1): roles de plataforma, solo
   * `superadmin`.
   */
  PLATFORM_ROLES: () => "/api/safety/platform-roles/",
  PLATFORM_ROLE_DETAIL: (userId: number | string) => `/api/safety/platform-roles/${userId}/`,
  /**
   * `GET /api/safety/audit/?actor=&action=&target_type=&target_id=&since=&until=`
   * (tarea P6 del backend, en curso al escribir esta tarea de panel: no
   * está todavía documentada en `docs/PANEL.md` — ver el informe de esta
   * tarea). Solo `superadmin`.
   */
  AUDIT: () => "/api/safety/audit/",
} as const;

export const ORGANIZATIONS = {
  /**
   * `GET /api/organizations/?verified=&parent=&search=&page=`
   * (`docs/SEGURIDAD_Y_MODERACION.md` §8): listado paginado de entidades,
   * cualquier autenticado. `POST` (mismo path) da de alta una entidad
   * (`verifier`/`superadmin`).
   */
  LIST: () => "/api/organizations/",
  /** `GET`/`PATCH /api/organizations/{id}/`. */
  DETAIL: (id: number | string) => `/api/organizations/${id}/`,
  /**
   * `POST /api/organizations/{id}/verify/` (§8): marca `is_verified=True`
   * (`verifier`/`superadmin`).
   */
  VERIFY: (id: number | string) => `/api/organizations/${id}/verify/`,
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
  /**
   * `GET`/`POST /api/organizations/{id}/resources/` (`docs/PANEL.md` §7):
   * biblioteca de recursos de la entidad. `POST` acepta `multipart/form-data`
   * cuando hay fichero.
   */
  RESOURCES: (id: number | string) => `/api/organizations/${id}/resources/`,
  /**
   * `GET`/`PATCH`/`DELETE /api/organizations/{id}/resources/{resource_id}/`
   * (`docs/PANEL.md` §7): un recurso concreto.
   */
  RESOURCE: (id: number | string, resourceId: number | string) =>
    `/api/organizations/${id}/resources/${resourceId}/`,
  /**
   * `GET`/`POST /api/organizations/{id}/invitations/` (`docs/PANEL.md`
   * §3b.1): alta de personas por invitación — listado (`?status=`
   * opcional) y creación manual, una persona.
   */
  INVITATIONS: (id: number | string) => `/api/organizations/${id}/invitations/`,
  /**
   * `POST /api/organizations/{id}/invitations/import/?dry_run=`
   * (`docs/PANEL.md` §3b.3): importación por `.csv`/`.xlsx`, multipart
   * `file`. `dry_run=true` no escribe nada, solo cuenta.
   */
  INVITATIONS_IMPORT: (id: number | string) => `/api/organizations/${id}/invitations/import/`,
  /**
   * `DELETE /api/organizations/{id}/invitations/{iid}/` (`docs/PANEL.md`
   * §3b.6): revoca una invitación `pending`.
   */
  INVITATION: (id: number | string, iid: number | string) =>
    `/api/organizations/${id}/invitations/${iid}/`,
  /**
   * `POST /api/organizations/{id}/invitations/{iid}/resend/`
   * (`docs/PANEL.md` §3b.6): reenvía el correo con el mismo token/código.
   */
  INVITATION_RESEND: (id: number | string, iid: number | string) =>
    `/api/organizations/${id}/invitations/${iid}/resend/`,
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
  /**
   * `GET`/`PATCH /api/communities/{id}/` — ficha completa de la
   * comunidad. El panel solo usa `PATCH` (`allow_cross_space`, POP
   * Familias, `docs/PANEL.md` §8.1); `POST /api/communities/` (crear,
   * `space:'families'` + `owner_org`) reutiliza `LIST` de arriba, mismo
   * path.
   */
  DETAIL: (id: string) => `/api/communities/${id}/`,
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
  /**
   * `GET /api/panel/entidad/{org_id}/people/{user_id}/support/`
   * (`docs/PANEL.md` §14.5): lo que ve el referente asignado de la red de
   * apoyo de esa persona. Solo el referente ve datos (titular/moderador
   * que no lo sean → 404 igual que la ficha; `analista` → 403).
   */
  PERSON_SUPPORT: (orgId: number | string, userId: number | string) =>
    `/api/panel/entidad/${orgId}/people/${userId}/support/`,
  /** `GET /api/panel/entidad/{org_id}/events/`. */
  EVENTS: (orgId: number | string) => `/api/panel/entidad/${orgId}/events/`,
  /**
   * `GET`/`POST /api/panel/entidad/{org_id}/announcements/`
   * (`docs/PANEL.md` §5): comunicaciones oficiales de la entidad.
   */
  ANNOUNCEMENTS: (orgId: number | string) => `/api/panel/entidad/${orgId}/announcements/`,
  /**
   * `GET`/`POST /api/panel/entidad/{org_id}/surveys/` (`docs/PANEL.md`
   * §6): encuestas de la entidad.
   */
  SURVEYS: (orgId: number | string) => `/api/panel/entidad/${orgId}/surveys/`,
  /**
   * `GET /api/panel/entidad/{org_id}/surveys/{sid}/results/`
   * (`docs/PANEL.md` §6.6): resultados agregados, con umbral.
   */
  SURVEY_RESULTS: (orgId: number | string, surveyId: number | string) =>
    `/api/panel/entidad/${orgId}/surveys/${surveyId}/results/`,
  /**
   * `GET /api/panel/entidad/{org_id}/families/` (`docs/PANEL.md` §8.3):
   * resumen del espacio POP Familias — sus comunidades, cuánta gente hay
   * en ellas, próximas actividades y últimos anuncios/recursos.
   */
  FAMILIES: (orgId: number | string) => `/api/panel/entidad/${orgId}/families/`,
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
  /**
   * `GET /api/panel/paraguas/{org_id}/compare/?since&until&group_by=comarca|
   * organization|place` (`docs/PANEL.md` §11, tarea B2): comparativa entre
   * el periodo pedido y el anterior de igual longitud. `group_by` es
   * obligatorio en esta ruta (400 con `{group_by: "Desglose obligatorio…"}`
   * si falta o no es uno de los tres valores).
   */
  COMPARE_PARAGUAS: (orgId: number | string) => `/api/panel/paraguas/${orgId}/compare/`,
  /**
   * `GET /api/panel/plataforma/compare/?since&until&group_by=comarca|
   * province|organization` (`docs/PANEL.md` §11). Igual que
   * `COMPARE_PARAGUAS`, sin `org_id`.
   */
  COMPARE_PLATAFORMA: () => `/api/panel/plataforma/compare/`,
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

/**
 * `docs/PANEL.md` §12 («Programas», tarea B3 backend / W3 panel): módulo
 * programa de la entidad — app `programs`, separada de `panel`. Listado y
 * ficha piden `ver_panel`; crear, editar, activar y cerrar piden
 * `gestionar_programas` (`titular`/`moderador`); el informe pide
 * `exportar_informes`, igual que el resto de exportaciones del panel.
 */
export const PROGRAMS = {
  /** `GET`/`POST /api/panel/entidad/{org_id}/programs/`. */
  LIST: (orgId: number | string) => `/api/panel/entidad/${orgId}/programs/`,
  /** `GET`/`PATCH /api/panel/entidad/{org_id}/programs/{program_id}/`. */
  DETAIL: (orgId: number | string, programId: number | string) =>
    `/api/panel/entidad/${orgId}/programs/${programId}/`,
  /** `POST .../programs/{program_id}/activate/`: `draft -> active`. */
  ACTIVATE: (orgId: number | string, programId: number | string) =>
    `/api/panel/entidad/${orgId}/programs/${programId}/activate/`,
  /** `POST .../programs/{program_id}/close/ {closing_notes}`: `active -> closed`. */
  CLOSE: (orgId: number | string, programId: number | string) =>
    `/api/panel/entidad/${orgId}/programs/${programId}/close/`,
  /** `GET .../programs/{program_id}/report/?format=csv|pdf`: informe final agregado. */
  REPORT: (orgId: number | string, programId: number | string) =>
    `/api/panel/entidad/${orgId}/programs/${programId}/report/`,
} as const;

/**
 * `docs/SEGURIDAD_Y_MODERACION.md` §7: verificación por niveles, cola de
 * revisión (`verifier`/`superadmin`).
 */
export const VERIFICATION = {
  /** `GET /api/users/verification/reviews/queue/` — cola `pending`, paginada. */
  REVIEWS_QUEUE: () => "/api/users/verification/reviews/queue/",
  /** `POST /api/users/verification/reviews/{id}/decide/ {approved, note?}`. */
  REVIEW_DECIDE: (id: string) => `/api/users/verification/reviews/${id}/decide/`,
} as const;

/**
 * `docs/PANEL.md` §13 («Contratos y facturación», tarea B4 backend / W4
 * panel): tramos de precio, contratos y facturas — área exclusiva de
 * plataforma, ninguna entidad la ve. Lectura `superadmin`/`support`
 * (`HasPlatformRole`); escritura (crear/editar/activar/finalizar/pagar)
 * solo `superadmin`, comprobada a mano dentro de cada vista (403 con
 * `{"detail": "Esta acción es solo para superadmin de plataforma."}`).
 */
export const BILLING = {
  /** `GET`/`POST /api/plataforma/billing/tiers/`. */
  TIERS: () => "/api/plataforma/billing/tiers/",
  /** `PATCH /api/plataforma/billing/tiers/{tier_id}/`. */
  TIER: (tierId: number | string) => `/api/plataforma/billing/tiers/${tierId}/`,
  /**
   * `GET`/`POST /api/plataforma/billing/contracts/?organization=&status=`
   * — los filtros los añade quien llama (`hooks/useBilling.ts`).
   */
  CONTRACTS: () => "/api/plataforma/billing/contracts/",
  /** `GET`/`PATCH /api/plataforma/billing/contracts/{contract_id}/`. */
  CONTRACT: (contractId: number | string) => `/api/plataforma/billing/contracts/${contractId}/`,
  /** `POST .../contracts/{contract_id}/activate/`: `draft -> active`. */
  CONTRACT_ACTIVATE: (contractId: number | string) =>
    `/api/plataforma/billing/contracts/${contractId}/activate/`,
  /** `POST .../contracts/{contract_id}/end/`: `active -> ended`. */
  CONTRACT_END: (contractId: number | string) => `/api/plataforma/billing/contracts/${contractId}/end/`,
  /** `GET`/`POST .../contracts/{contract_id}/invoices/`. */
  CONTRACT_INVOICES: (contractId: number | string) =>
    `/api/plataforma/billing/contracts/${contractId}/invoices/`,
  /** `POST /api/plataforma/billing/invoices/{invoice_id}/pay/ {paid_on}`. */
  INVOICE_PAY: (invoiceId: number | string) => `/api/plataforma/billing/invoices/${invoiceId}/pay/`,
  /**
   * `GET /api/plataforma/billing/summary/` (portada de plataforma):
   * `{active_contracts, annual_value_cents, overdue_invoices,
   * pending_amount_cents}`.
   */
  SUMMARY: () => "/api/plataforma/billing/summary/",
} as const;

/**
 * `GET /api/admin/dashboard-stats/` (`pop/dashboard_api.py::DashboardStatsView`):
 * agregados generales para el Inicio de plataforma. `IsAdminUser`
 * (`is_staff`, solo `superadmin` lo tiene hoy — ver `hooks/useDashboardStats.ts`,
 * que trata un 403 como «sin esa tarjeta» en vez de romper la página).
 */
export const DASHBOARD = {
  STATS: () => "/api/admin/dashboard-stats/",
} as const;
