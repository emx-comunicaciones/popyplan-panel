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
 * `GET /api/panel/entidad/{org_id}/people/` (`docs/PANEL.md` §3.2):
 * paginada (20 por página, `PageNumberPagination` estándar de DRF),
 * aunque `docs/schema.yaml` la documenta (mal) como un array plano —
 * `panel/viewsets.py::EntidadPeopleView.get` sí pagina de verdad
 * (`_PaginacionPersonas().get_paginated_response(...)`); el `@extend_schema`
 * de la vista no lo refleja. Tipo manual: no hay un `Paginated*List` para
 * esta ruta en `types.generated.ts`.
 */
export interface PaginatedPersonRowList {
  count: number;
  next: string | null;
  previous: string | null;
  results: PersonRow[];
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
 * (`docs/SEGURIDAD_Y_MODERACION.md` §4-§5): el Inicio de la entidad solo
 * necesita `count` de cada una, nunca las filas.
 */
export interface PaginatedCount {
  count: number;
}

/**
 * `GET /api/safety/reports/queue/?organization=<id>` (§4): paginada de
 * verdad, filas `Report` (sin `target`, a diferencia del detalle).
 */
export type ReportRow = components["schemas"]["Report"];
export interface PaginatedReportList {
  count: number;
  next: string | null;
  previous: string | null;
  results: ReportRow[];
}

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
