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
  /**
   * `POST /api/auth/admin-register/` (`users/auth_viewsets.py
   * ::AuthViewSet.admin_register`, `IsAdminUser`): alta de una cuenta
   * desde el admin de plataforma (`AdminUserCreateSerializer`: `email`,
   * `username`, `first_name?`, `last_name?`, `phone?`, `password?`). Nace
   * activa y verificada; sin `password` el backend genera uno aleatorio.
   * Responde 201 con `MeSerializer`, no con el `RegistrationResponse` que
   * declara el esquema (ver `lib/api/types.ts::PlatformAccount`).
   */
  ADMIN_REGISTER: "/api/auth/admin-register/",
  /**
   * `POST /api/auth/password/reset/ {email}` (`AuthViewSet.password_reset`,
   * público): manda a esa cuenta un código de 6 dígitos por correo, en su
   * idioma. El admin de plataforma lo usa en la ficha de una cuenta
   * («Enviar restablecimiento de contraseña»): no hay una acción propia
   * de staff para esto. 400 si el correo no existe. Comparte el límite
   * de peticiones del login (clave `ip:<ip>:auth`, 5/min).
   */
  PASSWORD_RESET: "/api/auth/password/reset/",
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
   * mano. El listado de cuentas del admin de plataforma
   * (`/plataforma/usuarios`, `hooks/usePlatformUsers.ts`) usa la misma
   * ruta con `?is_active=`/`?is_verified=`/`?ordering=-created_at`/`?page=`
   * (`PAGE_SIZE` fijo de 20: `?page_size=` no hace nada).
   */
  SEARCH: () => "/api/users/users/",
  /**
   * `PATCH /api/users/users/update_profile/ {preferred_language}`
   * (`users/unified_viewset.py::UsersViewSet.update_profile`,
   * `MeUpdateSerializer`, spec de diseño `2026-09-19-i18n-es-eu-ca`,
   * decisión 2). Lo usa `hooks/useUpdatePreferredLanguage.ts` para
   * guardar el idioma elegido en la cuenta cuando hay sesión — el
   * selector de idioma (`components/layout/LanguageSwitcher.tsx`)
   * tolera un fallo aquí (400 si el campo aún no está desplegado, 401
   * sin sesión real): la cookie `pp_lang` ya decide el idioma de la
   * interfaz sin depender de esta llamada.
   */
  UPDATE_PROFILE: "/api/users/users/update_profile/",
  /**
   * `GET`/`PATCH`/`DELETE /api/users/{id}/` (`users/unified_viewset.py
   * ::UserViewSet.retrieve/partial_update/destroy`). **Tres contratos
   * distintos en la misma ruta** (admin de plataforma, bloque 1):
   * - `GET` es el **perfil público** (`PublicProfileSerializer`: alias,
   *   foto, municipio, nivel de verificación), no la cuenta — y responde
   *   404 para una cuenta suspendida (`is_blocked`) o borrada.
   * - `PATCH` con `is_staff` usa `AdminUserUpdateSerializer` (`is_active`
   *   incluido) y responde `MeSerializer`, que **no** lleva `is_active`.
   * - `DELETE` (solo `is_staff`) es un borrado **real** (`user.delete()`),
   *   no el `soft_delete` de la baja propia; 400 si es la propia cuenta.
   */
  DETAIL: (id: number | string) => `/api/users/${id}/`,
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
  /**
   * `GET /api/safety/blocks/admin/?user=<id>` (`safety/viewsets.py
   * ::BlockViewSet.admin_list`, `HasPlatformRole('moderator',
   * 'superadmin')`): bloqueos hechos **por** esa cuenta o **contra** ella.
   * `?user=` es obligatorio (400 sin él, 404 si la cuenta no existe) — no
   * hay un listado global de bloqueos — y la respuesta es un **array
   * plano**, no la `PaginatedBlockAdminList` que declara el esquema.
   */
  BLOCKS_ADMIN: () => "/api/safety/blocks/admin/",
  /**
   * `DELETE /api/safety/blocks/{id}/admin/ {reason}` (`BlockViewSet
   * .admin_destroy`, mismo permiso): deshace un bloqueo ajeno; el motivo
   * (`BlockRevokeSerializer`, ≤300 caracteres, obligatorio) queda en el
   * `AuditLog` (`block.revoked_by_staff`). 204; 404 si ya no existe.
   */
  BLOCK_ADMIN_REVOKE: (id: string) => `/api/safety/blocks/${id}/admin/`,
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
   * `GET /api/communities/?owner_org=&search=&page=` — paginada.
   * `?owner_org=<id>` la filtra por entidad **y** activa el modo
   * privilegiado del backend (titular/moderador de esa entidad ven
   * también sus comunidades `private` y las de los dos espacios de POP
   * Familias, `communities/unified_viewset.py::get_queryset`), que es lo
   * que usa `hooks/useEntityCommunities.ts`.
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
   * comunidad. `PATCH` sirve tanto el cruce de espacios
   * (`allow_cross_space`, POP Familias, `docs/PANEL.md` §8.1) como
   * «Editar comunidad» (`name`/`description`/`visibility`/
   * `code_of_conduct`, `hooks/useUpdateCommunity.ts` — `space` no se
   * manda nunca, el backend lo rechaza tras crear la comunidad). `GET`
   * lo usa `hooks/useCommunity.ts` para traer `code_of_conduct`, el
   * único campo que le falta al listado (`CommunityList`) para rellenar
   * ese formulario. `POST /api/communities/` (crear, `space` +
   * `owner_org`) reutiliza `LIST` de arriba, mismo path.
   */
  DETAIL: (id: string) => `/api/communities/${id}/`,
  /**
   * `GET /api/communities/{id}/invite-code/` → `{invite_code}`. Solo
   * para quien gestiona la comunidad (para una comunidad con
   * `owner_org`, el titular/moderador de esa entidad) y solo si la
   * visibilidad es `private`: 403 y 400 respectivamente, los dos con
   * `{"error": …}` en vez de `{"detail": …}`
   * (`hooks/useCommunityInviteCode.ts`).
   */
  INVITE_CODE: (id: string) => `/api/communities/${id}/invite-code/`,
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
  /**
   * `GET/POST /api/events/` (`events/viewsets.py::EventViewSet`): alta
   * de actividad desde el panel (tarea de creación de actividades) —
   * siempre con `owner_org` (el sello de la entidad), nunca de perfil.
   */
  LIST: () => `/api/events/`,
  /** `GET/PATCH /api/events/{id}/` — detalle y edición (solo organizador). */
  DETAIL: (id: string) => `/api/events/${id}/`,
  /** `POST /api/events/{id}/cancel/` — solo organizador. */
  CANCEL: (id: string) => `/api/events/${id}/cancel/`,
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
  /**
   * `GET /api/panel/territorio/{org_id}/metrics/?since&until&group_by=
   * place|comarca|province|month|year` (spec de diseño
   * `2026-09-19-territorio-administraciones-design.md` §3.1): mismo
   * esquema fijo que paraguas, pero sobre `scope_territorio(org)` —
   * todo lo que ocurre en los municipios del `OrgScope`, sea de la
   * entidad que sea. `group_by=organization` **no** se ofrece aquí a
   * propósito: listar por nombre entidades que la administración no
   * financia sería exponer a terceros (§3.1). 403 si la organización no
   * es una administración; 409 si no tiene territorio declarado.
   */
  TERRITORIO: (orgId: number | string) => `/api/panel/territorio/${orgId}/metrics/`,
  /**
   * `GET /api/panel/territorio/{org_id}/compare/?since&until&group_by=
   * place|comarca|province` (§3.1). `group_by` obligatorio, igual que en
   * las otras dos rutas de comparativa.
   */
  COMPARE_TERRITORIO: (orgId: number | string) => `/api/panel/territorio/${orgId}/compare/`,
} as const;

/** Exportación de informes (CSV/PDF), `docs/PANEL.md` §2. */
export const EXPORT = {
  /** `GET /api/panel/entidad/{org_id}/export/?format=csv|pdf&since&until&group_by`. */
  ENTIDAD: (orgId: number | string) => `/api/panel/entidad/${orgId}/export/`,
  /** `GET /api/panel/paraguas/{org_id}/export/?format=csv|pdf&since&until&group_by`. */
  PARAGUAS: (orgId: number | string) => `/api/panel/paraguas/${orgId}/export/`,
  /** `GET /api/panel/plataforma/export/?format=csv|pdf&since&until&group_by`. */
  PLATAFORMA: () => `/api/panel/plataforma/export/`,
  /** `GET /api/panel/territorio/{org_id}/export/?format=csv|pdf&since&until&group_by` (spec §3.1). */
  TERRITORIO: (orgId: number | string) => `/api/panel/territorio/${orgId}/export/`,
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

/**
 * Observatorio de territorio (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §3.2). Las
 * métricas, la comparativa y la exportación viven en `METRICS`/`EXPORT`
 * junto a las de los otros ámbitos; aquí solo la ficha de municipio, que
 * no tiene equivalente en paraguas.
 */
export const TERRITORIO = {
  /**
   * `GET /api/panel/territorio/{org_id}/places/{ine_code}/?since&until`:
   * ficha agregada de un municipio del territorio. 404 si el municipio
   * no pertenece al territorio de esa administración (nunca se revela
   * nada de un municipio de fuera). Permiso `ver_panel` + administración.
   */
  // `encodeURIComponent` (M10 de la revisión final de rama): `ineCode`
  // viene de `by_place[].key` del backend, no de una constante propia —
  // hoy son dígitos y no rompe, pero nada garantiza que siga siendo así.
  PLACE_SHEET: (orgId: number | string, ineCode: string) =>
    `/api/panel/territorio/${orgId}/places/${encodeURIComponent(ineCode)}/`,
} as const;

/**
 * Catálogo de municipios (spec §3.3): solo lectura, autenticado,
 * paginado y limitado a `is_active`, sin ningún dato personal. El panel
 * lo usa para dos cosas: las coordenadas del mapa de Territorio
 * (`?ine_code=a,b`) y el buscador de sede de plataforma y de
 * Configuración (`?search=`).
 */
export const PLACES = {
  /**
   * `GET /api/places/?ine_code=&search=&ccaa_code=&prov_code=
   * &comarca_code=&page=`. Los tres filtros de código son de
   * coincidencia exacta y combinables con `search`/`ine_code`; el
   * `count` de la respuesta paginada es el total del filtro, que es lo
   * que usa la vista previa «N municipios» del formulario de territorio
   * (`components/plataforma/TerritorioForm.tsx`) para no traerse las
   * filas.
   */
  LIST: () => "/api/places/",
} as const;

// ---------------------------------------------------------------------------
// Admin de plataforma, bloque 3: el resto del admin antiguo (2026-09-26).
// Todas estas rutas dan el acceso amplio por `is_staff` (`IsAdminUser` o
// un `user.is_staff` en el propio código), nunca por `PlatformRole`; en
// el panel solo las usa `superadmin` (`lib/auth/plataformaMenu.ts`).
// Ninguna escribe en `AuditLog` (ver CLAUDE.md, «Admin de plataforma:
// el resto del admin antiguo»).
// ---------------------------------------------------------------------------

/**
 * Publicaciones de comunidad vistas por la plataforma. El listado de
 * comunidades es el mismo `COMMUNITIES.LIST`: a `is_staff` el backend le
 * sirve **todas** (privadas, de entidad, de los dos espacios e
 * inactivas), salvo las de entidades que esa cuenta haya ocultado a
 * título personal. Desactivar es `PATCH COMMUNITIES.DETAIL {is_active}`
 * y borrar `DELETE` (borrado real), los dos `is_staff`.
 */
export const COMMUNITY_POSTS = {
  /**
   * `GET /api/community-posts/?community=&is_active=&page=`
   * (`communities/unified_viewset.py::AdminCommunityPostViewSet`,
   * `IsAdminUser`): activas y ocultas, de la más reciente a la más
   * antigua, paginadas de 20 en 20. `?search=` no hace nada.
   */
  LIST: () => "/api/community-posts/",
  /**
   * `PATCH`/`DELETE /api/community-posts/{id}/`: ocultar/mostrar es
   * `PATCH {is_active}` (no hay `is_hidden`); `DELETE` es borrado real.
   */
  DETAIL: (id: string) => `/api/community-posts/${id}/`,
} as const;

/**
 * Actividades vistas por la plataforma. **No hay un listado global**:
 * `GET /api/events/` exige `?community=` (400 sin él) y a `is_staff` le
 * da todas las de esa comunidad, pasadas y canceladas incluidas
 * (`EVENTS.LIST`). Detalle y cancelación son `EVENTS.DETAIL`/
 * `EVENTS.CANCEL`, que `Event.is_organizer` concede a `is_staff`.
 */
export const PLATFORM_EVENTS = {
  /**
   * `GET /api/events/agenda/?from=&to=&page=` (`EventViewSet.agenda`):
   * solo `scheduled` desde `from` (por defecto, ahora), con audiencia
   * `anyone` u `organization` de entidades de las que la cuenta sea
   * miembro — sin atajo para staff. Paginada de 20 en 20.
   */
  AGENDA: () => "/api/events/agenda/",
} as const;

export const REVIEWS = {
  /**
   * `GET /api/reviews/?event=&page=` (`reviews/unified_viewset.py
   * ::ReviewViewSet`): a `is_staff` le da **todas**, 20 por página. El
   * esquema la envuelve dos veces; el cuerpo real es la paginación
   * estándar.
   */
  LIST: () => "/api/reviews/",
  /**
   * `DELETE /api/reviews/{id}/`: autor o `is_staff`. Responde **200**
   * `{"message": …}` (no el 204 del esquema); el 403 trae `{"error": …}`.
   */
  DETAIL: (id: string) => `/api/reviews/${id}/`,
} as const;

export const ADMIN_CHATS = {
  /**
   * `GET /api/admin/chats/?chat_type=&search=&page=`
   * (`chats/admin_viewset.py::AdminChatViewSet`, `IsAdminUser`): salas
   * activas, la última actualizada primero. `?search=` solo mira `name`.
   * En el listado `last_message` llega **siempre `null`**.
   */
  LIST: () => "/api/admin/chats/",
  /** `GET /api/admin/chats/{id}/` — la sala, con sus participantes. */
  DETAIL: (id: string) => `/api/admin/chats/${id}/`,
  /**
   * `GET`/`POST /api/admin/chats/{id}/messages/`: `GET` es un **array
   * plano** (del más antiguo al más reciente); `POST {content}` responde
   * 201 con el mensaje, que sale con la cuenta **real** de quien lo manda
   * y no se audita. El esquema dice `ChatRoom` en los dos sentidos.
   */
  MESSAGES: (id: string) => `/api/admin/chats/${id}/messages/`,
} as const;

export const NOTIFICATIONS = {
  /**
   * `POST /api/notifications/send/` (`NotificationViewSet.send`,
   * `IsAdminUser`): `{title, message, notification_type, priority?,
   * target: "user"|"all", user_id?}`. A una persona: 201 `{detail,
   * recipients}`; a todas: 202 `{detail}` (encolado). Nunca aplica
   * plantillas.
   */
  SEND: () => "/api/notifications/send/",
  /** `GET`/`POST /api/notification-templates/` (`IsAdminUser`, 20 por página). */
  TEMPLATES: () => "/api/notification-templates/",
  /** `PATCH`/`DELETE /api/notification-templates/{id}/`. */
  TEMPLATE: (id: number | string) => `/api/notification-templates/${id}/`,
} as const;

/**
 * Nomencladores vivos del backend. Tres formas de listado: array plano
 * (`/api/catalogs/*` y subcategorías de comunidad), paginación estándar
 * (categorías de comunidad) y `{results, count}` sin paginar (categorías
 * y subcategorías de actividad). Escritura `IsAdminUser` en todos.
 */
export const CATALOGS = {
  HOBBY_CATEGORIES: () => "/api/catalogs/hobby-categories/",
  HOBBY_CATEGORY: (id: number | string) => `/api/catalogs/hobby-categories/${id}/`,
  HOBBIES: () => "/api/catalogs/hobbies/",
  HOBBY: (id: number | string) => `/api/catalogs/hobbies/${id}/`,
  LANGUAGES: () => "/api/catalogs/languages/",
  LANGUAGE: (id: number | string) => `/api/catalogs/languages/${id}/`,
  COMMUNITY_CATEGORIES: () => "/api/community-categories/",
  COMMUNITY_CATEGORY: (id: string) => `/api/community-categories/${id}/`,
  COMMUNITY_SUBCATEGORIES: () => "/api/community-subcategories/",
  COMMUNITY_SUBCATEGORY: (id: string) => `/api/community-subcategories/${id}/`,
  EVENT_CATEGORIES: () => "/api/event-categories/",
  EVENT_CATEGORY: (id: number | string) => `/api/event-categories/${id}/`,
  EVENT_SUBCATEGORIES: () => "/api/event-subcategories/",
  EVENT_SUBCATEGORY: (id: string) => `/api/event-subcategories/${id}/`,
} as const;

/**
 * Búsqueda del tesoro (admin de plataforma, bloque 2, 2026-09-26;
 * `docs/PANEL.md` §16 del backend, `treasure_hunt/unified_viewset.py`).
 * Todas las rutas de administración piden `is_staff` o `PlatformRole`
 * superadmin (`treasure_hunt/permissions.py::es_gestor_de_juegos`).
 * `{id}` es el **UUID** del juego; **ningún listado pagina**
 * (`pagination_class = None`): todos son arrays planos.
 */
export const TREASURE_HUNT = {
  /** `GET` (filtros `?status=`/`?city=`/`?featured=`) y `POST` (alta, nace `draft`, `event_id: null`). */
  LIST: () => "/api/treasure-hunt/",
  /** `GET` `GameDetail`, `PATCH` (→ `GameDetail`, no los campos de escritura) y `DELETE` (borra también su actividad). */
  DETAIL: (id: string) => `/api/treasure-hunt/${id}/`,
  /** `draft` → `open`: aquí nace la actividad espejo (`event_id`). 400 si no es borrador. */
  OPEN: (id: string) => `/api/treasure-hunt/${id}/open/`,
  /** `open` → `in_progress`. 400 sin pistas o si no está abierto. */
  START: (id: string) => `/api/treasure-hunt/${id}/start/`,
  /** `in_progress` → `finished` (actividad `completed`). */
  FINISH: (id: string) => `/api/treasure-hunt/${id}/finish/`,
  /** `GET` pistas completas (`GameStep[]`, sin `correct_answer`, que nunca viaja de vuelta). */
  STEPS_LIST: (id: string) => `/api/treasure-hunt/${id}/steps/list/`,
  /** `POST` alta de pista (`GameStepCreate`) → 201 `GameStepPublic`. */
  STEPS: (id: string) => `/api/treasure-hunt/${id}/steps/`,
  /** `PATCH`/`DELETE` de una pista (borrar reordena las posteriores). */
  STEP: (id: string, stepId: string) => `/api/treasure-hunt/${id}/steps/${stepId}/`,
  /** `GET` (ordenados por `rank_from`) y `POST` tramos de premio. */
  PRIZE_TIERS: (id: string) => `/api/treasure-hunt/${id}/prize-tiers/`,
  /** `PATCH`/`DELETE` de un tramo. */
  PRIZE_TIER: (id: string, tierId: string) => `/api/treasure-hunt/${id}/prize-tiers/${tierId}/`,
  /** `GET ?status=pending|accepted|rejected` (`GameParticipant[]`). */
  PARTICIPANTS: (id: string) => `/api/treasure-hunt/${id}/participants/`,
  /** `POST`: solo con solicitud `pending` y juego `draft`/`open`; `participantId` es un entero. */
  PARTICIPANT_APPROVE: (id: string, participantId: number) =>
    `/api/treasure-hunt/${id}/participants/${participantId}/approve/`,
  PARTICIPANT_REJECT: (id: string, participantId: number) =>
    `/api/treasure-hunt/${id}/participants/${participantId}/reject/`,
  /** `GET` (`Ranking[]`, solo equipos listos para jugar). */
  RANKING: (id: string) => `/api/treasure-hunt/${id}/ranking/`,
  /** `GET` envíos de foto/prueba social pendientes de revisión (`StepCompletionAdmin[]`). */
  COMPLETIONS: (id: string) => `/api/treasure-hunt/${id}/completions/`,
  /** `POST {is_valid, points_override?}`: aprobar da puntos y avanza; rechazar borra el envío (el equipo reintenta). */
  COMPLETION_VALIDATE: (id: string, completionId: string) =>
    `/api/treasure-hunt/${id}/completions/${completionId}/validate/`,
} as const;

/**
 * Catálogo de entrenamiento y plantillas de Popyplan (Nomencladores de
 * plataforma, 2026-09-26; `docs/PANEL.md` §17.1-§17.2 del backend,
 * `training/viewsets.py`). Leer, cualquier cuenta; escribir, `is_staff` o
 * `PlatformRole` superadmin. Los tres listados **paginan** (20 por página,
 * se recorren con tope). Las plantillas se piden **siempre** con
 * `?scope=system`: el panel nunca lista rutinas de nadie (ni las del
 * propio staff), y no hay aquí ninguna ruta de entrenos, rutinas ni
 * perfiles deportivos — a propósito (el entrenamiento es privado).
 */
export const TRAINING = {
  /** `GET` (paginado; staff ve también las inactivas), `POST`. */
  DISCIPLINES: () => "/api/training/disciplines/",
  /** `PATCH`/`DELETE` (409 «Está en uso…» si tiene ejercicios, plantillas o entrenos). */
  DISCIPLINE: (id: number) => `/api/training/disciplines/${id}/`,
  /** `GET ?discipline=<id>` (paginado), `POST` (con `discipline_id`). */
  EXERCISES: () => "/api/training/exercises/",
  /** `PATCH`/`DELETE`. */
  EXERCISE: (id: number) => `/api/training/exercises/${id}/`,
  /** `GET ?scope=system` (paginado), `POST {…, system: true}`. */
  TEMPLATES: () => "/api/training/templates/",
  /** `PATCH` (`items`, si viene, reemplaza la lista entera) y `DELETE`. */
  TEMPLATE: (id: number) => `/api/training/templates/${id}/`,
} as const;
