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

/** Respuesta de `POST /api/auth/login/`. */
export type LoginResponse = components["schemas"]["LoginResponse"];

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
