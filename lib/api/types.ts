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
