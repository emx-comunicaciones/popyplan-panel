/**
 * Tipos de dominio usados por el panel, elegidos a mano desde
 * `types.generated.ts` (generado con `npm run gen:types` desde
 * `../popyplan/docs/schema.yaml`). No reexportamos el fichero generado
 * entero para que cada import documente qué endpoint lo origina.
 */
import type { components } from "./types.generated";

/**
 * `GET /api/users/users/me/`. Ensancha el esquema generado con
 * `preferred_language` (spec de diseño `2026-09-19-i18n-es-eu-ca`,
 * decisión 2): el backend ya lo devuelve
 * (`users/models.py::User.preferred_language`, `blank=True,
 * default=''`, `''` cuando la cuenta no ha elegido idioma —
 * `users/profile_serializers.py::MeSerializer`), pero
 * `docs/schema.yaml` todavía no se ha regenerado para esta tarea (es
 * trabajo de la tarea 6 del propio backend, verificado leyendo
 * `users/profile_serializers.py`/`users/tests/test_profile_api.py`, no
 * solo el esquema) — `Me` del esquema generado no lo lleva. Mismo
 * patrón de ensanche manual que `FamiliesSummary`/`PeopleMetrics` en
 * otras rondas de este fichero; se puede quitar en cuanto
 * `npm run gen:types` lo traiga solo.
 *
 * **Opcional, no obligatorio** (M6 de la revisión final de la rama de
 * i18n): un backend desplegado antes de esta tarea (o un `/me/` real
 * contra ese backend, plan decisión 2) no trae el campo en absoluto —
 * `hooks/useAuth.ts::applyAccountLanguage` ya lo trata como ausente con
 * `isSupportedLanguage(undefined) === false`, así que declararlo
 * obligatorio hacía mentir al tipo en runtime sin que ningún consumidor
 * lo necesitara así.
 */
export type Me = components["schemas"]["Me"] & {
  preferred_language?: string;
};

/**
 * `PATCH /api/users/users/update_profile/`
 * (`users/unified_viewset.py::UsersViewSet.update_profile`). **No hay
 * mismatch de contrato aquí** (corregido en M5 de la revisión final de
 * la rama de i18n — la nota anterior sí lo afirmaba, y era falsa): el
 * `@extend_schema` de la vista declara `responses={200: MeSerializer}`
 * y el código real lo cumple —
 * `users/profile_serializers.py::MeUpdateSerializer.to_representation`
 * delega en `MeSerializer(user, context=self.context).data`—, así que
 * la vista devuelve un `Me` completo de verdad (`id`/`org_memberships`
 * incluidos). Este tipo se limita a `preferred_language` porque es el
 * único campo que el panel necesita confirmar
 * (`hooks/useUpdatePreferredLanguage.ts`), no porque la respuesta real
 * traiga menos.
 */
export interface UpdatePreferredLanguageResponse {
  preferred_language: string;
}

/** Una entidad dentro de `Me.org_memberships`. */
export type OrgMembershipRef = components["schemas"]["OrgMembershipRef"];

/**
 * El tipo de organización de cada membresía **sí** llega, y se llama
 * `organization_type` (`users/profile_serializers.py::OrgMembershipRefSerializer`,
 * `source='organization.org_type'`): está en `OrgMembershipRef` del esquema
 * generado como `string` obligatorio, así que `resolveArea`
 * (`lib/auth/area.ts::isParaguas`) lo lee de ahí sin ampliar nada.
 *
 * Lo único que este tipo añade es `org_type?`, el nombre que la nota
 * original de la tarea W1 daba por bueno y que el backend nunca ha usado:
 * `isParaguas` lo sigue aceptando como respaldo (y varios fixtures de test
 * lo usan), de modo que un payload con cualquiera de los dos nombres
 * resuelve igual. Si algún día se retiran esos fixtures, se puede borrar
 * el campo y la rama de `isParaguas` a la vez.
 */
export type OrgMembershipForArea = OrgMembershipRef & {
  org_type?: components["schemas"]["OrgTypeEnum"];
  /**
   * `users/profile_serializers.py::OrgMembershipRefSerializer`, spec
   * §3.5: el backend deriva este booleano de `org_type` para que el
   * panel deje de comparar cadenas. Opcional porque un backend anterior
   * al despliegue no lo trae — `lib/auth/area.ts::isParaguas` lo usa
   * cuando está y cae al respaldo por `organization_type` cuando no
   * (spec §7). Tipo manual hasta `npm run gen:types`.
   */
  is_administration?: boolean;
  admin_level?: AdminLevel;
};

export type MeForArea = Omit<Me, "org_memberships"> & {
  org_memberships: OrgMembershipForArea[];
};

/** `GET /api/safety/platform-roles/me/`. */
export type PlatformRoleMe = components["schemas"]["PlatformRoleMe"];

/**
 * Nivel administrativo de una organización de tipo `administracion`
 * (spec de diseño `2026-09-19-territorio-administraciones-design.md`
 * §2.1). Cadena vacía en todo lo que no es una administración: el
 * backend lo declara `CharField(choices, blank=True)`, no nullable.
 *
 * **Tipo manual, provisional**: se retira en cuanto la rama de backend
 * `feature/territorio-*` esté fusionada y se regenere el esquema con
 * `npm run gen:types` (spec §7, «regenerar tipos desde
 * docs/schema.yaml»). Mismo patrón que `Me.preferred_language` más
 * arriba en este fichero.
 */
export type AdminLevel = "ayuntamiento" | "mancomunidad" | "diputacion" | "gobierno" | "";

/**
 * Forma del territorio declarado (spec §2.1): un atajo (`ccaa`,
 * `provincia`, `comarca`) o una lista literal de municipios
 * (`municipios`); cadena vacía si la administración no tiene territorio.
 * `territory_code` guarda el código del atajo o, con `municipios`, los
 * códigos INE separados por comas. Tipo manual, misma nota que
 * `AdminLevel`.
 */
export type TerritoryKind = "ccaa" | "provincia" | "comarca" | "municipios" | "";

/**
 * `GET`/`PATCH /api/organizations/{id}/`, ensanchado con los cuatro
 * campos de territorio de la spec §2.1 más el recuento derivado
 * `territory_places_count` (solo lectura: cuántos municipios tiene hoy
 * el `OrgScope` expandido). Todos opcionales porque un backend anterior
 * al despliegue de este bloque no los trae (spec §7) — el panel trata su
 * ausencia igual que `place: null` (ver `EntidadDetail`/`SedeSelector`).
 * Tipo manual, misma nota que `AdminLevel`.
 */
export type Organization = components["schemas"]["Organization"] & {
  /** Código INE de la sede (`Place.ine_code`), `null` si no la tiene. */
  place?: string | null;
  admin_level?: AdminLevel;
  territory_kind?: TerritoryKind;
  territory_code?: string;
  readonly territory_places_count?: number;
};

export type OrgMembershipRole = components["schemas"]["OrgMembershipRoleEnum"];

export type OrgTypeEnum = components["schemas"]["OrgTypeEnum"];

/** Respuesta de `POST /api/auth/login/` (`docs/PANEL.md` §0: incluye `refresh`). */
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

/**
 * `GET /api/panel/{paraguas,plataforma}/compare/` (`docs/PANEL.md` §11,
 * tarea B2): compara el periodo pedido con el inmediatamente anterior de
 * igual longitud, desglosado por `group_by` (obligatorio en esta ruta,
 * a diferencia de métricas). `current`/`previous` de cada fila comparten
 * la forma de una celda suprimible (`people`/`attendance_rate` sujetos al
 * umbral, `events` nunca); `delta` es la resta indicador a indicador,
 * `null` + `suppressed: true` si cualquiera de los dos lados está
 * suprimido (`delta.events` sí se calcula siempre).
 */
export type CompareResponse = components["schemas"]["CompareResponse"];
export type CompareRow = components["schemas"]["CompareRow"];
export type CompareCelda = components["schemas"]["CompareCelda"];
export type CompareDelta = components["schemas"]["CompareDelta"];
export type ComparePeriodo = components["schemas"]["ComparePeriodo"];

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
 * paginada (20 por página, `PageNumberPagination` estándar de DRF).
 *
 * **Al día (auditoría 2026-09):** el mismatch original ya no existe. El
 * esquema documentaba esta ruta como un array plano, pero hoy trae
 * `PersonRowPage` (`{count, next, previous, results: PersonRow[]}`), que
 * sí refleja lo que devuelve `panel/viewsets.py::EntidadPeopleView.get`.
 * Este tipo sigue siendo manual por otra razón: `results` es
 * `PersonListRow[]`, porque con `?include_invited=true` las últimas filas
 * de la página son `InvitedPersonRow` (§3b.7) y eso el esquema no lo
 * declara. Si algún día `PersonRowPage.results` admite las dos formas,
 * este tipo puede pasar a ser un alias del generado.
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
 * `HelpRequest.user_display` gana `is_member`/`referent` (tarea «ficha,
 * pertenencia y referente en los avisos de ayuda»): si la persona tiene
 * membresía en la entidad del aviso, y su referente ahí (`{id,
 * public_name}`), si tiene uno asignado. Al escribir esta tarea el
 * backend lo expone en `docs/schema.yaml` como `HelpRequestUserDisplay`
 * (commit 57f8e1d): alias directo del tipo generado.
 */
export type HelpRequestUserDisplay = components["schemas"]["HelpRequestUserDisplay"];

/**
 * `GET /api/safety/help-requests/pending/?organization=<id>` (§5): sin
 * paginar de verdad (`Response(HelpRequestSerializer(qs, many=True).data)`
 * en `safety/viewsets.py`), pese a que `docs/schema.yaml` la marca (mal)
 * como `PaginatedHelpRequestList` — mismo patrón que `Attendee` en W3.
 */
export type HelpRequestRow = Omit<components["schemas"]["HelpRequest"], "user_display"> & {
  user_display: HelpRequestUserDisplay;
};

/**
 * `HelpRequestRow.support_responses` (`docs/PANEL.md` §14.4, tarea 1 del
 * plan de red de apoyo): un apoyo de la red de la persona que ya
 * respondió «me encargo» (`POST /api/support/help-requests/{id}/respond/`,
 * `support.SupportHelpNotice`). **Solo los que respondieron** — a quién
 * más se avisó es cosa de la persona, no de la entidad (invariante 9: solo
 * `{id, public_name}`, nunca contacto). Sin consumidor todavía: exportado
 * para que `GuardiaPanel.tsx`/`AyudaPendienteList.tsx` puedan pintar «X,
 * de su red, se encarga» sin tener que repetir el índice del array.
 */
export type SupportResponse = HelpRequestRow["support_responses"][number];

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
 * **La ampliación a mano que este tipo llevaba ya no hace falta**: el fix
 * de backend que suprime `members_count` (`null` + `suppressed: true`)
 * para quien no tiene `ver_lista_nominal` llegó documentado en
 * `docs/schema.yaml` con la tarea de la red de apoyo (§14.5) —
 * `FamiliesSummary.members_count`/`FamilyCommunityRow.members_count` ya
 * son `number | null` con `suppressed: boolean` obligatorio en el
 * esquema generado, así que se usan tal cual.
 */
export type FamiliesSummaryCommunityRow = components["schemas"]["FamilyCommunityRow"];
/**
 * §14.5 (red de apoyo): además del resumen de comunidades de familias de
 * siempre, trae los cuatro contadores agregados de
 * `support.services.metrics.families_counters` — `people_with_support_network`/
 * `active_supporters`/`supporters_notified_on_help` como
 * `SuppressibleCount` (`{value: number | null; suppressed: boolean}`,
 * misma regla de supresión que el resto del panel, `PANEL_MIN_GROUP_SIZE`)
 * y `missing_families_space_supporters` como entero sin umbral (no
 * describe personas, describe una tarea pendiente de la propia entidad).
 * Ya llegan tipados así en el esquema generado, sin ampliación a mano.
 */
export type FamiliesSummary = components["schemas"]["FamiliesSummary"];
/** `{value: number | null; suppressed: boolean}` — ver `FamiliesSummary` arriba. */
export type SuppressibleCount = components["schemas"]["SuppressibleCount"];
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
 * `docs/PANEL.md` §12 («Programas», tarea B3 backend / W3 panel): módulo
 * programa de la entidad — campaña con fechas cerradas, presupuesto
 * declarado (`budget_cents`, céntimos) e informe final agregado.
 * Invariante 1 extendida: la salida nunca lista personas.
 */
export type Program = components["schemas"]["Program"];
export type ProgramStatus = components["schemas"]["ProgramStatusEnum"];
/** Cuerpo de `POST .../programs/{id}/close/`. */
export type ProgramCloseRequest = components["schemas"]["ProgramCloseRequest"];

/**
 * Campos editables de un programa (`ProgramInputSerializer`,
 * `programs/serializers.py` en el backend): `name`/`starts_on`/`ends_on`/
 * `budget_cents` obligatorios, `description`/`funder` opcionales
 * (`required=False, default=''`). El esquema generado
 * (`PatchedProgramInputRequest`) marca `description`/`funder` como
 * obligatorios pese al `partial=True` real de `PATCH` — quirk de
 * drf-spectacular con un campo `default=''` no de solo lectura, mismo
 * patrón de mismatches ya documentado en este fichero (`Attendee`,
 * `HelpRequestRow`…). Tipo manual con todos los campos opcionales, que es
 * el comportamiento real de `ProgramDetailView.patch`.
 */
export interface ProgramWriteFields {
  name: string;
  description: string;
  funder: string;
  starts_on: string;
  ends_on: string;
  budget_cents: number;
}

/**
 * `GET /api/safety/audit/` y `GET /api/panel/entidad/{id}/audit/`.
 *
 * **Al día (auditoría 2026-09):** el esquema ya trae `AuditLog` y
 * `PaginatedAuditLogList` (el backend regeneró `docs/schema.yaml` tras la
 * tarea P6), así que la nota anterior — «no existe en
 * `types.generated.ts`» — ya no vale. `AuditActor` pasa a ser un alias
 * del generado, idéntico campo a campo. `AuditLogEntry` sigue siendo
 * manual por dos diferencias reales con `AuditLog`:
 *
 * 1. `ip?: string | null` no está en el generado. El serializer solo la
 *    añade cuando el contexto trae `show_ip=True` (`audit-list`,
 *    exclusivo de `superadmin`; la vista acotada a una entidad nunca la
 *    manda), y drf-spectacular no sabe declarar un campo condicional.
 * 2. `metadata` es `Record<string, unknown>` aquí y `unknown` en el
 *    generado: `AuditoriaPanel` la recorre como pares `clave=valor`, y
 *    con `unknown` habría que comprobar la forma en cada uso.
 *
 * `PaginatedAuditLogList` también es manual: el generado marca todos sus
 * campos como opcionales (drf-spectacular lo hace en cada respuesta
 * paginada) y `results` lleva `AuditLog`, no `AuditLogEntry`.
 */
export type AuditActor = components["schemas"]["AuditActor"];
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

/**
 * `docs/PANEL.md` §13 («Contratos y facturación», tarea B4 backend / W4
 * panel): tramos de precio, contratos y facturas de una entidad — área
 * exclusiva de plataforma (ninguna entidad, ni siquiera su titular, la
 * ve). Lectura `superadmin`/`support`; escritura (crear/editar/activar/
 * finalizar/pagar) solo `superadmin`, comprobada a mano en cada vista
 * (`hooks/useBilling.ts`). Invariante 7: un contrato `ended` no limita
 * ninguna función de la entidad — este módulo solo lee/escribe
 * `billing`, nunca condiciona otro permiso.
 */
export type PricingTier = components["schemas"]["PricingTier"];
/** Entrada de `POST .../tiers/`. */
export type PricingTierCreateRequest = components["schemas"]["PricingTierInputRequest"];
/**
 * Entrada de `PATCH .../tiers/{id}/` (`partial=True`). El esquema
 * generado (`PatchedPricingTierInputRequest`) marca `min_population`/
 * `is_active` como obligatorios pese al `partial=True` real del backend
 * (`PricingTierInputSerializer(required=False, default=…)`) — mismo
 * quirk de drf-spectacular con un campo `default` no de solo lectura ya
 * documentado en `ProgramWriteFields` (más arriba en este fichero). Tipo manual con todo
 * opcional, que es el comportamiento real de `PricingTierDetailView.patch`.
 */
export interface PricingTierUpdateRequest {
  name?: string;
  min_population?: number;
  max_population?: number | null;
  annual_price_cents?: number;
  is_active?: boolean;
}

/**
 * Salida de un contrato (`ContractSerializer`): entidad y tramo
 * resumidos (`_OrganizationBrief`/`_TierBrief`) más `invoices_count`/
 * `pending_amount_cents` calculados. El esquema generado marca
 * `starts_on`/`ends_on`/`status`/`notes` como `readonly` porque son de
 * solo lectura en *este* serializer de salida — la escritura real va por
 * `ContractCreateRequest`/`ContractUpdateRequest`, no por `Contract`.
 */
export type Contract = components["schemas"]["Contract"];
export type ContractStatus = components["schemas"]["ContractStatusEnum"];
/** Entrada de `POST .../contracts/`: `organization`/`tier` por id. */
export type ContractCreateRequest = components["schemas"]["ContractInputRequest"];
/**
 * Entrada de `PATCH .../contracts/{id}/` (`partial=True`): solo fechas y
 * notas — `organization`/`tier`/`status` no se tocan por aquí (`status`
 * cambia con `activate`/`end`, `docs/PANEL.md` §13.1).
 */
export type ContractUpdateRequest = components["schemas"]["PatchedContractUpdateRequest"];

export type Invoice = components["schemas"]["Invoice"];
/**
 * `Invoice.status` (`docs/PANEL.md` §13.1: propiedad calculada, nunca
 * persistida — `paid` si `paid_on`, si no `overdue`/`pending` según
 * `due_on`) llega como `string` a secas en `types.generated.ts`
 * (drf-spectacular no anota el `SerializerMethodField` con un literal).
 * Tipo manual con los tres valores reales, para pintar el chip de estado
 * sin un `string` suelto.
 */
export type InvoiceStatus = "paid" | "pending" | "overdue";
/** Entrada de `POST .../contracts/{id}/invoices/`: `number` único (400 si se repite). */
export type InvoiceCreateRequest = components["schemas"]["InvoiceInputRequest"];
/** Entrada de `POST .../invoices/{id}/pay/`. */
export type InvoicePayRequest = components["schemas"]["InvoicePayRequest"];

/** `GET .../summary/` (portada de plataforma, `docs/PANEL.md` §13.2). */
export type BillingSummary = components["schemas"]["BillingSummary"];

/**
 * `GET /api/panel/entidad/{org_id}/people/{user_id}/support/`
 * (`docs/PANEL.md` §14.5): lo único que ve el referente asignado de la
 * red de apoyo de una persona — solo vínculos efectivos (activos y sin
 * pausa), nunca fechas, contacto, pendientes ni quién invitó a quién. El
 * esquema generado llama a esta fila `ReferentNetworkRow`
 * (`support/serializers.py`, spec §5.2), no `PersonSupportRow`: se
 * realiasa aquí con el nombre que usa el resto de este módulo para lo
 * que ve el panel de una persona (`PersonDetail`, `PersonRow`…).
 */
export type PersonSupportRow = components["schemas"]["ReferentNetworkRow"];
/** `relationship` de un vínculo de la red de apoyo (`docs/PANEL.md` §14.2). */
export type SupportRelationship = components["schemas"]["RelationshipEnum"];

/**
 * `POST /api/organizations/` con la sede obligatoria (spec §4.3, «Alta
 * de entidad: sede obligatoria»): el serializer de alta exige `place`
 * (código INE). Tipo manual hasta `npm run gen:types`.
 */
export type OrganizationCreateInput = OrganizationCreateRequest & {
  place: string;
};

/**
 * Fila de `GET /api/places/?ine_code=a,b&search=&ccaa_code=&prov_code=
 * &comarca_code=&page=` (spec §3.3, ampliada con los tres filtros de
 * código por decisión del coordinador del bloque): listado de municipios
 * de solo lectura, autenticado y paginado (solo `is_active`), sin ningún
 * dato personal. Los tres filtros de código son de coincidencia exacta y
 * combinables entre sí y con `search`/`ine_code`; el `count` de
 * `PaginatedPlaceList` es el total que casa con el filtro, no el tamaño
 * de la página. Tipo manual hasta `npm run gen:types`.
 *
 * `latitude`/`longitude` se declaran `number | null` siguiendo el
 * ejemplo de la spec §3.2. Quien las consuma las pasa igualmente por
 * `lib/metrics/mapScale.ts::toFiniteNumber`, porque un `DecimalField` de
 * DRF puede llegar serializado como cadena según la configuración del
 * backend y una coordenada no numérica no puede pintar una burbuja.
 */
export interface PlaceRow {
  ine_code: string;
  name: string;
  name_local: string;
  comarca_code: string;
  comarca_name_es: string;
  comarca_name_eu: string;
  prov_code: string;
  prov_name: string;
  ccaa_code: string;
  ccaa_name: string;
  latitude: number | null;
  longitude: number | null;
}

/** Envoltorio DRF estándar de `GET /api/places/`. */
export interface PaginatedPlaceList {
  count: number;
  next: string | null;
  previous: string | null;
  results: PlaceRow[];
}

/** El municipio dentro de la ficha de `GET …/territorio/{org}/places/{ine}/`. */
export interface PlaceSheetPlace {
  ine_code: string;
  name: string;
  name_local: string;
  comarca_name_es: string;
  prov_name: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * `GET /api/panel/territorio/{org_id}/places/{ine_code}/?since&until`
 * (spec §3.2): ficha agregada de un municipio del territorio.
 * `organizations_based_here` es un **recuento** de organizaciones con
 * sede ahí, nunca sus nombres (invariante 1). `people`/`attendance`
 * respetan el umbral `PANEL_MIN_GROUP_SIZE` igual que el resto del
 * panel. Tipo manual hasta `npm run gen:types`.
 */
export interface PlaceSheet {
  place: PlaceSheetPlace;
  events: { held: number; upcoming: number };
  people: { value: number | null; suppressed: boolean };
  attendance: { rate: number | null; suppressed: boolean };
  communities: { count: number };
  organizations_based_here: number;
}
