/**
 * Tipos de dominio usados por el panel, elegidos a mano desde
 * `types.generated.ts` (generado con `npm run gen:types` desde
 * `../popyplan/docs/schema.yaml`). No reexportamos el fichero generado
 * entero para que cada import documente qué endpoint lo origina.
 */
import type { components } from "./types.generated";

/** `GET /api/users/users/me/`. */
export type Me = components["schemas"]["Me"];

/** Una entidad dentro de `Me.org_memberships`. */
export type OrgMembershipRef = components["schemas"]["OrgMembershipRef"];

/**
 * `OrgMembershipRef` tal y como lo devuelve hoy el backend nunca incluye
 * `org_type` (ver `users/profile_serializers.py::OrgMembershipRefSerializer`):
 * solo lo tiene `Organization` completa. `resolveArea` (`lib/auth/area.ts`)
 * acepta el campo como opcional para poder distinguir una entidad paraguas
 * (`org_type === 'administracion'`) el día que el backend lo añada a este
 * serializer, sin romper el contrato actual mientras tanto.
 */
export type OrgMembershipForArea = OrgMembershipRef & {
  org_type?: components["schemas"]["OrgTypeEnum"];
};

export type MeForArea = Omit<Me, "org_memberships"> & {
  org_memberships: OrgMembershipForArea[];
};

/** `GET /api/safety/platform-roles/me/`. */
export type PlatformRoleMe = components["schemas"]["PlatformRoleMe"];

/** `GET`/`PATCH /api/organizations/{id}/`. */
export type Organization = components["schemas"]["Organization"];

export type OrgMembershipRole = components["schemas"]["OrgMembershipRoleEnum"];

export type OrgTypeEnum = components["schemas"]["OrgTypeEnum"];

/** Respuesta de `POST /api/auth/login/` (`docs/PANEL.md` §0: incluye `refresh`). */
export type LoginResponse = components["schemas"]["LoginResponse"];

/** Respuesta de `POST /api/auth/token/refresh/` (`docs/PANEL.md` §0). */
export type TokenRefreshResponse = components["schemas"]["TokenRefresh"];

/**
 * `GET /api/panel/{entidad,paraguas,plataforma}/*\/metrics/`
 * (`docs/PANEL.md` §1.4, esquema fijo). `people`/`attendance`/
 * `communities` llevan su propio `suppressed` de sección; cada fila de
 * `by_place`/`by_weekday_hour`/`series` lleva el suyo en `people`.
 */
export type MetricsResponse = components["schemas"]["MetricsResponse"];
export type PeopleMetrics = components["schemas"]["PeopleMetrics"];
export type EventsMetrics = components["schemas"]["EventsMetrics"];
export type EventsByAudience = components["schemas"]["EventsByAudience"];
export type AttendanceMetrics = components["schemas"]["AttendanceMetrics"];
export type CommunitiesMetrics = components["schemas"]["CommunitiesMetrics"];
export type ByPlaceRow = components["schemas"]["ByPlaceRow"];
export type ByWeekdayHourRow = components["schemas"]["ByWeekdayHourRow"];
export type SeriesRow = components["schemas"]["SeriesRow"];

/**
 * `docs/PANEL.md` §3 («Personas y actividades»). `PersonRow` es la fila
 * de `GET .../people/` y también la base de `PersonDetail`
 * (`GET .../people/{user_id}/`, que añade `communities`/`events`/
 * `verification_level`). Ninguno de los dos lleva `email`/`phone`/
 * `birth_date`/`document*`/`notes` (invariante 9): no están en el
 * esquema generado porque el serializer del backend nunca los expone.
 */
export type PersonRow = components["schemas"]["PersonRow"];
export type PersonDetail = components["schemas"]["PersonDetail"];
export type PersonCommunityRow = components["schemas"]["PersonCommunityRow"];
export type PersonEventRow = components["schemas"]["PersonEventRow"];
export type ReferentRef = components["schemas"]["ReferentRef"];
export type NextEventRef = components["schemas"]["NextEventRef"];

/**
 * Fila «Invitada (pendiente)» que `GET .../people/?include_invited=true`
 * añade al final de cada página (`docs/PANEL.md` §3b.7, tarea W3b): nunca
 * lleva `user_id` ni el resto de campos de `PersonRow` — solo lo
 * necesario para pintar la fila y actuar sobre la invitación
 * (reenviar/revocar por `invitation_id`). `email` no viaja aquí (invariante
 * 9/minimización): solo `display_name`, que también se borra si la
 * invitación deja de estar `pending` (§3b.2), aunque en la práctica esta
 * fila nunca aparece salvo para invitaciones `pending`.
 */
export interface InvitedPersonRow {
  invitation_id: number;
  display_name: string;
  status: "invited";
  invited_at: string | null;
}

/** Fila de `GET .../people/`: una persona ya miembro, o una invitación pendiente (§3b.7). */
export type PersonListRow = PersonRow | InvitedPersonRow;

/**
 * `GET /api/panel/entidad/{org_id}/people/` (`docs/PANEL.md` §3.2):
 * paginada (20 por página, `PageNumberPagination` estándar de DRF),
 * aunque `docs/schema.yaml` la documenta (mal) como un array plano —
 * `panel/viewsets.py::EntidadPeopleView.get` sí pagina de verdad
 * (`_PaginacionPersonas().get_paginated_response(...)`); el `@extend_schema`
 * de la vista no lo refleja. Tipo manual: no hay un `Paginated*List` para
 * esta ruta en `types.generated.ts`. Con `?include_invited=true`, algunas
 * filas del final de la página son `InvitedPersonRow` en vez de
 * `PersonRow` (§3b.7).
 */
export interface PaginatedPersonRowList {
  count: number;
  next: string | null;
  previous: string | null;
  results: PersonListRow[];
}

/** `GET /api/panel/entidad/{org_id}/events/` (`docs/PANEL.md` §3.4). Sin paginar. */
export type EntityEventRow = components["schemas"]["EntityEventRow"];
export type EntityEventCommunityRef = components["schemas"]["EntityEventCommunityRef"];
export type EntityEventOrganizerRef = components["schemas"]["EntityEventOrganizerRef"];

/**
 * `GET /api/events/{id}/attendees/`: array plano de `Attendee`, pese a
 * que `docs/schema.yaml` la marca como `PaginatedAttendeeList` —
 * `events/viewsets.py::EventViewSet.attendees` construye la respuesta a
 * mano (`Response(AttendeeSerializer(filas, many=True, ...).data)`, sin
 * paginador) y drf-spectacular envuelve igual porque el `ViewSet` tiene
 * `pagination_class` por defecto para sus acciones estándar. Ver
 * «Desviaciones» en el informe de esta tarea.
 */
export type Attendee = components["schemas"]["Attendee"];

/** Cuerpo de `POST /api/events/{id}/attendance/`. */
export type AttendanceMarkRequest = components["schemas"]["AttendanceMarkRequest"];
/** Respuesta real de `POST /api/events/{id}/attendance/`: `{user_id, status}` (`events/viewsets.py`). */
export interface AttendanceMarkResponse {
  user_id: number;
  status: components["schemas"]["AttendeeStatusEnum"];
}

/** Cuerpo de `POST /api/events/{id}/checkin/`. */
export type CheckinRequest = components["schemas"]["CheckinRequest"];
/**
 * Respuesta real de `POST /api/events/{id}/checkin/`: `{status, already}`
 * (`docs/PANEL.md` §4.3), aunque `docs/schema.yaml` la marca (mal) como
 * `EventDetail` — el `@extend_schema` de `checkin` en `events/viewsets.py`
 * no declara `responses=`, así que drf-spectacular usa por defecto el
 * serializer del `ViewSet` (`EventDetailSerializer`).
 */
export interface CheckinResponse {
  status: "attended";
  already: boolean;
}

/**
 * `GET`/`POST`/`DELETE /api/organizations/{id}/references/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §8).
 */
export type Reference = components["schemas"]["Reference"];
export interface PaginatedReferenceList {
  count: number;
  next: string | null;
  previous: string | null;
  results: Reference[];
}

/**
 * `GET /api/safety/reports/queue/` y `GET /api/safety/help-requests/pending/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §4-§5): ninguna de las dos pagina de
 * verdad (`ReportViewSet.queue`/`HelpRequestViewSet.pending` responden
 * `Response(Serializer(qs, many=True).data)`, un array plano — nunca
 * `{count, next, previous, results}`, pese a que `docs/schema.yaml` las
 * marque mal como paginadas, mismo patrón que `Attendee`/`HelpRequestRow`
 * más abajo). Corregido en la tarea W6 tras un fallo real en
 * `e2e/plataforma.spec.ts` (`ReportesQueuePlataforma.tsx` leía
 * `reports.data.results` de un array, `TypeError: Cannot read
 * properties of undefined (reading 'length')`) y una revisión de
 * `useEntityHome.ts::fetchOptionalCount`, que hacía lo mismo con
 * `.count` para las dos tarjetas de guardia del Inicio de entidad — el
 * Inicio nunca había mostrado un recuento real, solo `undefined`,
 * porque ningún test lo ejercitaba contra el backend de verdad. El
 * Inicio de entidad cuenta ahora `.length` del array.
 */

/**
 * `GET /api/safety/reports/queue/?organization=<id>` (§4): array plano
 * de `Report` (sin `target`, a diferencia del detalle) — nunca
 * paginado, ver arriba.
 */
export type ReportRow = components["schemas"]["Report"];

/** `GET /api/safety/reports/{id}/` (§4): añade `target` sobre `Report`. */
export type ReportDetail = components["schemas"]["ReportDetail"];
export type ReportTarget = components["schemas"]["ReportTarget"];
export type ReportResolution = components["schemas"]["ReportResolveResolutionEnum"];
/** Cuerpo de `POST /api/safety/reports/{id}/resolve/`. */
export type ReportResolveRequest = components["schemas"]["ReportResolveRequest"];
/** Cuerpo de `POST /api/safety/reports/{id}/escalate/`. */
export type ReportEscalateRequest = components["schemas"]["ReportEscalateRequest"];

/**
 * `GET /api/safety/help-requests/pending/?organization=<id>` (§5): sin
 * paginar de verdad (`Response(HelpRequestSerializer(qs, many=True).data)`
 * en `safety/viewsets.py`), pese a que `docs/schema.yaml` la marca (mal)
 * como `PaginatedHelpRequestList` — mismo patrón que `Attendee` en W3.
 */
export type HelpRequestRow = components["schemas"]["HelpRequest"];

/**
 * `GET /api/communities/{id}/members/`, `.../pending-requests/` y las
 * respuestas de `approve`/`reject`/`role` (`CommunityMemberSerializer`,
 * `communities/serializers.py`). `docs/schema.yaml` documenta mal estas
 * rutas: las marca como si devolvieran `Community` completa (o un array
 * de ella); en realidad son esto, uno o en lista. Tipo manual: no existe
 * en `types.generated.ts`.
 */
export interface CommunityMember {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  profile_picture: string | null;
  /** `owner` nunca sale de `members`/`pending-requests` con este rol salvo el propietario. */
  role: "owner" | "moderator" | "member";
  status: "active" | "pending" | "rejected" | "left";
  accepted_conduct_at: string | null;
  is_online: boolean;
  joined_at: string;
}

/** Cuerpo de `PATCH /api/communities/{id}/members/{member_id}/role/`. */
export interface CommunityMemberRoleRequest {
  role: "moderator" | "member";
}

/**
 * `owner` de `CommunityList`/`Community` (`Community.owner_display()`,
 * `communities/models.py`): `types.generated.ts` lo deja como
 * `{[key: string]: unknown}` porque el esquema no tipa el diccionario.
 */
export interface CommunityOwnerRef {
  type: "organization" | "profile";
  id: number | string;
  name: string;
  verified: boolean;
  logo?: string | null;
}

/**
 * `GET /api/communities/?...` (`CommunityListSerializer`): fila de la
 * lista general, paginada (`PageNumberPagination` estándar). El panel la
 * usa para «Comunidades» de la entidad filtrando `owner` en el cliente —
 * ver el hueco documentado en el informe de esta tarea: no existe un
 * `?owner_org=` en el backend, así que una comunidad `private` de la
 * entidad que quien mira no integre no aparece (regla de
 * `communities/services/visibility.py::_visibles_para`).
 */
export type EntityCommunityRow = Omit<components["schemas"]["CommunityList"], "owner"> & {
  owner: CommunityOwnerRef;
};
export interface PaginatedCommunityList {
  count: number;
  next: string | null;
  previous: string | null;
  results: EntityCommunityRow[];
}

/**
 * `GET`/`POST`/`DELETE /api/organizations/{id}/members/` (§8): equipo
 * completo de la entidad, sin paginar de verdad
 * (`Response(OrgMembershipSerializer(qs, many=True).data)` en
 * `entities/viewsets.py`) pese a que el esquema generado lleve
 * `PaginatedOrgMembershipList` — mismo patrón que `references` y
 * `Attendee`.
 */
export type OrgMembershipFull = components["schemas"]["OrgMembership"];
/** Cuerpo de `POST /api/organizations/{id}/members/`. */
export type OrgMembershipCreateRequest = components["schemas"]["OrgMembershipRequest"];

/**
 * `GET /api/organizations/{id}/references/`: mismo patrón — array plano
 * de verdad (`entities/viewsets.py::OrganizationViewSet.references`),
 * aunque exista un `PaginatedReferenceList` (arriba) pensado para una
 * paginación que esta ruta no aplica hoy.
 */
export type ReferenceList = Reference[];

/** Cuerpo de `POST /api/organizations/{id}/scope/`. */
export type OrgScopeRequest =
  | { places: string[] }
  | { province: string }
  | { comarca: string };
/** Respuesta de `POST /api/organizations/{id}/scope/`: `{added, total}`. */
export interface OrgScopeResponse {
  added: number;
  total: number;
}

/**
 * `docs/PANEL.md` §5 («Comunicaciones oficiales»):
 * `GET`/`POST /api/panel/entidad/{org_id}/announcements/`. Array plano
 * (`@extend_schema` de la vista no envuelve en paginador — verificado
 * contra `panel/viewsets.py`, no solo el esquema).
 */
export type Announcement = components["schemas"]["Announcement"];
/** Cuerpo de `POST /api/panel/entidad/{org_id}/announcements/`. */
export type AnnouncementCreateRequest = components["schemas"]["AnnouncementCreateRequest"];
/**
 * `audience` real (`docs/PANEL.md` §5.2) es una de estas tres formas; el
 * esquema generado la deja como `string` a secas (el backend reconstruye
 * la forma de entrada/salida a mano, sin enum) — este tipo documenta las
 * formas válidas para el formulario de composición, sin sustituir al tipo
 * generado en las respuestas.
 */
export type AnnouncementAudienceInput = "members" | "families" | `community:${string}`;

/**
 * `docs/PANEL.md` §6 («Encuestas»): `GET`/`POST
 * /api/panel/entidad/{org_id}/surveys/` y `.../surveys/{sid}/results/`.
 * Listado sin paginar (mismo patrón que `Announcement`).
 */
export type Survey = components["schemas"]["Survey"];
export type SurveyCreateRequest = components["schemas"]["SurveyCreateRequest"];
export type SurveyQuestion = components["schemas"]["SurveyQuestion"];
export type SurveyQuestionInput = components["schemas"]["SurveyQuestionInputRequest"];
/** `kind` de una encuesta: `post_event` (automática) o `periodic` (creada desde el panel). */
export type SurveyKind = components["schemas"]["Kind049Enum"];
/** `kind` de una pregunta: `stars_1_5`, `scale_4` o `text_short`. */
export type SurveyQuestionKind = components["schemas"]["KindFe1Enum"];
/** Fila agregada de `GET .../surveys/{sid}/results/`. */
export type SurveyQuestionResult = components["schemas"]["SurveyQuestionResult"];
/** `GET /api/panel/entidad/{org_id}/surveys/{sid}/results/` (`docs/PANEL.md` §6.6). */
export type SurveyResults = components["schemas"]["SurveyResults"];

/**
 * `docs/PANEL.md` §7 («Biblioteca de recursos»): `GET`/`POST
 * /api/organizations/{org_id}/resources/` y `GET`/`PATCH`/`DELETE
 * .../resources/{rid}/`. Listado sin paginar. `EntityResourceWriteRequest`
 * admite `multipart/form-data` (fichero) además de JSON — ver
 * `hooks/useCreateResource.ts`/`useUpdateResource.ts`, que construyen un
 * `FormData` cuando hay fichero y JSON normal cuando no lo hay.
 */
export type EntityResource = components["schemas"]["EntityResource"];
export type EntityResourceWriteRequest = components["schemas"]["EntityResourceWriteRequest"];
export type PatchedEntityResourceWriteRequest =
  components["schemas"]["PatchedEntityResourceWriteRequest"];
/** `category` de un recurso (`docs/PANEL.md` §7.1). */
export type ResourceCategory = components["schemas"]["CategoryEnum"];
/** `kind` de un recurso (`docs/PANEL.md` §7.1). */
export type ResourceKind = components["schemas"]["Kind839Enum"];
/** `audience` de un recurso (`docs/PANEL.md` §7.2): `members`, `families` o `public`. */
export type ResourceAudience = components["schemas"]["Audience743Enum"];

/**
 * `docs/PANEL.md` §8 («POP Familias», tarea P6): `GET /api/panel/entidad
 * /{org_id}/families/` — resumen del espacio separado de la entidad.
 * `Community.space`/`allow_cross_space` ya llegan en `EntityCommunityRow`
 * (`CommunityList` los expone, §8.1) y no necesitan tipo propio.
 *
 * **Ampliación a mano de esta tarea**: el fix de backend que suprime
 * `members_count` (`null` + `suppressed: true`) para quien no tiene
 * `ver_lista_nominal` en la entidad llega en paralelo a este trabajo —
 * `docs/schema.yaml` todavía documenta `FamiliesSummary.members_count` y
 * `FamilyCommunityRow.members_count` como `number` a secas. Se amplían
 * aquí a `number | null` con un `suppressed?` opcional (mismo patrón que
 * `PeopleMetrics`), para que `useFamiliesSummary` funcione tanto contra
 * el contrato documentado hoy como contra el que trae la supresión, sin
 * esperar a regenerar `types.generated.ts`. `hooks/useFamiliesSummary.ts`
 * normaliza cualquiera de las dos formas antes de que `formatCount`
 * (`lib/metrics/format.ts`) decida qué pintar.
 */
export type FamiliesSummaryCommunityRow = Omit<
  components["schemas"]["FamilyCommunityRow"],
  "members_count"
> & {
  members_count: number | null;
  suppressed?: boolean;
};
export type FamiliesSummary = Omit<
  components["schemas"]["FamiliesSummary"],
  "communities" | "members_count"
> & {
  communities: FamiliesSummaryCommunityRow[];
  members_count: number | null;
  suppressed?: boolean;
};
export type FamilyUpcomingEvent = components["schemas"]["FamilyUpcomingEvent"];
export type FamilyAnnouncementRow = components["schemas"]["FamilyAnnouncementRow"];
export type FamilyResourceRow = components["schemas"]["FamilyResourceRow"];

/**
 * Cuerpo de `POST /api/communities/` para crear una comunidad de
 * familias (§8.1): `space: 'families'` y `owner_org` son obligatorios en
 * la práctica (sin `owner_org` el backend da 400 — «solo una comunidad
 * con `owner_org` puede ser `families`»), aunque `CommunityRequest` los
 * deje opcionales en el esquema general (una comunidad normal de perfil
 * no los lleva).
 */
export interface CreateFamiliesCommunityRequest {
  name: string;
  description?: string;
  visibility?: components["schemas"]["VisibilityEnum"];
  code_of_conduct?: string;
  space: "families";
  owner_org: number;
}

/** Cuerpo de `PATCH /api/communities/{id}/` para el cruce de espacios (§8.1). */
export interface ToggleCrossSpaceRequest {
  allow_cross_space: boolean;
}

/**
 * `docs/PANEL.md` §3b («Alta de personas: invitaciones e importación»,
 * tarea W3b): `GET`/`POST /api/organizations/{org_id}/invitations/`,
 * `.../invitations/{iid}/resend/` y `.../invitations/{iid}/` (`DELETE`).
 * `email`/`display_name` solo llevan dato mientras `status='pending'`
 * (minimización de datos, §3b.2/§3b.4): al aceptarse, caducar o
 * revocarse se borran y el listado los muestra vacíos sin dejar de
 * listar la fila.
 */
export type EntityInvitation = components["schemas"]["EntityInvitation"];
export type EntityInvitationStatus = components["schemas"]["EntityInvitationStatusEnum"];
/** Cuerpo de `POST /api/organizations/{org_id}/invitations/` (§3b.2). */
export type EntityInvitationCreateRequest = components["schemas"]["EntityInvitationCreateRequest"];

/**
 * `POST /api/organizations/{org_id}/invitations/import/?dry_run=`
 * (`docs/PANEL.md` §3b.3): tipo manual — el esquema generado no declara
 * el cuerpo de la respuesta 200 (`@extend_schema` de la vista no lleva
 * `responses=`, mismo patrón que `AttendanceMarkResponse`/`CheckinResponse`
 * en W3), así que se toma tal cual del contrato documentado.
 */
export interface ImportPeopleRowError {
  row: number;
  email: string;
  error: string;
}
export interface ImportPeopleResult {
  created: number;
  resent: number;
  already_members: number;
  errors: ImportPeopleRowError[];
}

/**
 * `docs/SEGURIDAD_Y_MODERACION.md` §8 (tarea W5, panel de plataforma):
 * `GET /api/organizations/?verified=&parent=&search=&page=`, truly
 * paginada (`PageNumberPagination` estándar, a diferencia de la mayoría
 * de rutas de `panel/`, que no paginan de verdad — aquí sí, verificado
 * contra `entities/viewsets.py::OrganizationViewSet` sin `pagination_class`
 * propio, así que hereda el de DRF). `POST` (mismo path) da de alta una
 * entidad.
 */
export type PaginatedOrganizationList = components["schemas"]["PaginatedOrganizationList"];
/** Cuerpo de `POST /api/organizations/` (§8). */
export type OrganizationCreateRequest = components["schemas"]["OrganizationCreateRequest"];

/**
 * `docs/SEGURIDAD_Y_MODERACION.md` §1: roles de plataforma
 * (`safety.PlatformRole`), solo `superadmin`. `GET
 * /api/safety/platform-roles/` no pagina de verdad (`Response(...,
 * many=True)` sobre un queryset sin paginador, según el propio contrato:
 * "lista sin paginar de roles vigentes").
 */
export type PlatformRole = components["schemas"]["PlatformRole"];
export type PlatformRoleName = components["schemas"]["Role636Enum"];
/** Cuerpo de `POST /api/safety/platform-roles/`. */
export type PlatformRoleGrantRequest = components["schemas"]["PlatformRoleGrantRequest"];

/**
 * `docs/SEGURIDAD_Y_MODERACION.md` §7: cola de revisión de verificación
 * (`verifier`/`superadmin`), `GET /api/users/verification/reviews/queue/`
 * — paginada de verdad (`PaginatedVerificationReviewList`, coincide con
 * el esquema).
 */
export type VerificationReview = components["schemas"]["VerificationReview"];
export type PaginatedVerificationReviewList =
  components["schemas"]["PaginatedVerificationReviewList"];
/** Cuerpo de `POST /api/users/verification/reviews/{id}/decide/`. */
export type VerificationReviewDecideRequest =
  components["schemas"]["VerificationReviewDecideRequest"];

/**
 * `GET /api/users/users/?search=` (`users/unified_viewset.py::list_users`):
 * el `@extend_schema` de la vista declara `UserListResponse` (envuelve
 * `UserProfile`), pero el código real serializa con `MeSerializer` sobre
 * la paginación estándar de DRF — mismo patrón de mismatch que el resto
 * de esta fase. Tipo manual acotado a lo que usa el buscador de
 * `roles/page.tsx`: id, usuario y correo, nada de perfil completo.
 */
export interface PlatformUserSearchRow {
  id: number;
  username: string;
  email: string;
}
export interface PaginatedPlatformUserSearchList {
  count: number;
  next: string | null;
  previous: string | null;
  results: PlatformUserSearchRow[];
}

/**
 * `GET /api/admin/dashboard-stats/` (`pop/dashboard_api.py::DashboardStatsView`):
 * sin serializer declarado (`drf-spectacular` no puede inferirlo, según
 * el propio informe de la tarea P5), así que no hay tipo generado. Tipo
 * manual tomado directamente del código de la vista.
 */
export interface DashboardStats {
  totals: { users: number; events: number; chats: number; communities: number };
  users: {
    active: number;
    blocked: number;
    verified: number;
    new_today: number;
    new_week: number;
    growth_pct: number;
  };
  events: {
    scheduled: number;
    growth_pct: number;
    by_audience: { audience: string; count: number }[];
  };
  reports: { pending: number };
  help_requests: { pending: number };
  registrations_weekly: { date: string; count: number }[];
}

/**
 * `GET /api/safety/audit/` y `GET /api/panel/entidad/{id}/audit/` (tarea
 * P6 del backend, en curso al escribir esta tarea de panel — no
 * documentada todavía en `docs/PANEL.md`; ver el informe de esta tarea
 * para el porqué y para la forma confirmada leyendo
 * `safety/serializers.py::AuditLogSerializer` directamente). Forma fija:
 * `{id, actor, action, target_type, target_id, metadata, ip?, created_at}`
 * — `ip` solo para `superadmin` vía `/api/safety/audit/` (nunca en la
 * vista acotada a una entidad). Tipo manual: no existe en
 * `types.generated.ts` porque el backend aún no ha regenerado el esquema.
 */
export interface AuditActor {
  id: number;
  public_name: string;
}
export interface AuditLogEntry {
  id: string;
  actor: AuditActor;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  ip?: string | null;
  created_at: string;
}
export interface PaginatedAuditLogList {
  count: number;
  next: string | null;
  previous: string | null;
  results: AuditLogEntry[];
}
