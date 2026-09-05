# CLAUDE.md — Popyplan Panel

Panel web de Popyplan (Next.js 15, App Router, TypeScript estricto,
Tailwind CSS 4, TanStack Query 5). Consume la misma API Django/DRF que
`~/Code/popyplan-mobile` (repo backend: `~/Code/popyplan`, Fase 5). Login
JWT contra el backend; sin servidor de datos propio.

## Qué es

Tres áreas por rol, cada una bajo su propia ruta:

- **`/entidad/[slug]`** — panel de una asociación/ONG/administración con
  rol de `OrgMembership` (`titular`, `moderador`, `dinamizador`,
  `analista`, `referente`). Menú de 13 secciones (Inicio, Personas,
  Comunidades, Actividades, Asistencia, Comunicaciones, Encuestas,
  Recursos, Familias, Reportes, Guardia, Informes, Configuración), con
  visibilidad por rol (`lib/auth/entidadMenu.ts`).
- **`/paraguas/[slug]`** — panel agregado de una entidad paraguas (p. ej.
  una diputación) sobre sus entidades hijas: Inicio (métricas) e
  Informes (exportación), ver «Vista del financiador» más abajo.
- **`/plataforma`** — panel del equipo de Popyplan (`safety.PlatformRole`:
  `superadmin`, `verifier`, `moderator`, `support`). Menú de 8 secciones
  (Inicio, Entidades, Reportes, Ayuda, Verificaciones, Roles, Auditoría,
  Métricas), con visibilidad por rol (`lib/auth/plataformaMenu.ts`) —
  ver «Área de plataforma» más abajo.

`lib/auth/area.ts::resolveArea(me, platformRole)` decide el área: el rol
de plataforma manda sobre cualquier rol de entidad; con varias entidades
elegibles, `/elegir-entidad` deja escoger.

**Regla de paraguas (documentada, importante para quien siga esta
tarea):** `GET /api/users/users/me/` (`OrgMembershipRefSerializer`,
`users/profile_serializers.py` en el backend) **no expone `org_type`**
por cada membresía hoy — solo `Organization` completa lo tiene. Esta
tarea trata una membresía como paraguas únicamente si el payload alguna
vez expone `org_type === 'administracion'` (campo opcional en
`OrgMembershipForArea`, `lib/api/types.ts`); mientras no lo haga, toda
membresía resuelve a `entidad`. Si el backend añade el campo, no hace
falta tocar `resolveArea`.

## Contratos que consume (repo backend `~/Code/popyplan`)

- `POST /api/auth/login/` (`users/auth_viewsets.py::AuthViewSet.login`):
  `{username_or_email, password}` → `{key, refresh, user}` (`refresh`
  desde la tarea W3, `docs/PANEL.md` §0).
- `POST /api/auth/token/refresh/` (`docs/PANEL.md` §0): `{refresh}` →
  `{access, refresh}` (rotado). Ver «Diseño de sesión» más abajo.
- `GET /api/users/users/me/` — perfil propio + `org_memberships`.
- `GET /api/safety/platform-roles/me/` — `{role: string|null}`.
- `GET /api/organizations/{id}/` — ficha de la entidad (nombre, logo,
  `primary_color`/`secondary_color`) para la cabecera del panel.
- `docs/SEGURIDAD_Y_MODERACION.md` (§1, §5, §8) y `docs/PANEL.md` (§1
  métricas, §2 exportación, §3 personas/actividades, §4 check-in QR)
  documentan el resto.

## Vista del financiador: métricas y exportación (tarea W2)

`GET /api/panel/{entidad,paraguas,plataforma}/*/metrics/` y
`GET /api/panel/{entidad,paraguas,plataforma}/*/export/` (`docs/PANEL.md`
§1-§2) tienen un esquema de respuesta fijo (`people`, `events`,
`attendance`, `communities`, `by_place`, `by_weekday_hour`, `series`) y
un solo `group_by` por petición: pedir a la vez «por municipio» y «por
entidad» (paraguas) requiere dos llamadas distintas
(`hooks/useMetrics.ts::useMetrics(scope, orgId, period, groupBy)`), una
por cada `group_by`, más una sin `group_by` para las tarjetas. El panel
de paraguas (`components/metrics/ParaguasMetricsDashboard.tsx`) hace
cuatro llamadas por periodo: base, `place`, `organization` y `month`. El
de plataforma (`PlataformaMetricsDashboard.tsx`) hace tres, con un
selector territorio/entidad que decide si la llamada de desglose usa
`place` u `organization`.

**Regla de renderizado de la supresión** (`PANEL_MIN_GROUP_SIZE=5`,
`docs/PANEL.md` §1.5): una celda que cuenta personas llega como
`value: null, suppressed: true` cuando el grupo tiene menos de 5
personas distintas. `lib/metrics/format.ts` (`formatCount`/`formatPct`)
es el único sitio que decide qué pintar (`'<5'` cuando `suppressed`,
`'—'` cuando `value` es `null` sin supresión, si no el valor formateado
con separador de miles/coma decimal, locale `es-ES`); los componentes de
`components/metrics/*` (`StatCard`, `MetricsTable`) siempre reciben ya
la cadena formateada, nunca deciden por sí mismos si algo está
suprimido — así la regla no se puede duplicar ni desincronizar entre
tarjetas y tablas.

Componentes compartidos: `components/metrics/{StatCard,PeriodSelector,
MetricsTable,SeriesChart,ExportButtons,ExportPanel}.tsx` (`SeriesChart`
usa `recharts`; los tests mockean `ResponsiveContainer` en
`vitest.setup.ts` porque jsdom no implementa `ResizeObserver`).
`lib/metrics/period.ts` calcula los presets (mes en curso, últimos 3/12
meses) y valida `since<=until` y ≤366 días (misma regla que el
backend); `lib/metrics/format.ts` formatea. `hooks/useExport.ts` hace el
`fetch` del fichero a mano (no `lib/api/client.ts::apiFetch`, que
siempre espera JSON) y dispara la descarga con un `<a download>`
temporal; 503 (WeasyPrint no disponible, `docs/PANEL.md` §2.3) →
`ExportError('pdf_unavailable')`, 403 → `ExportError('forbidden')`.

Desviación conocida: el brief pedía una columna «asistencia %» en la
tabla «Por municipio», pero `ByPlaceRow` (`docs/PANEL.md` §1.4) no lleva
una tasa de asistencia por fila (solo `events`/`people`) — la tabla
muestra Municipio, Código INE, Eventos y Personas; la asistencia global
solo está en la tarjeta «Asistencia» de la sección base.

## Operativa de la entidad: Inicio, Personas, Actividades, Asistencia (tarea W3)

`docs/PANEL.md` §3 (personas/actividades) y §4 (check-in por QR).
Páginas bajo `app/entidad/[slug]/`, cada una Server Component (sesión +
membresía + redirect) que delega en un componente cliente de
`components/entidad/*.tsx` con los hooks:

- **Inicio** (`page.tsx` → `EntityHomeDashboard`, hook `useEntityHome`):
  compone actividades de hoy (`useEntityEvents` con `since=until=hoy`),
  avisos de ayuda y reportes pendientes (solo `count`,
  `GET /api/safety/{help-requests/pending,reports/queue}/?organization=`)
  y las métricas del mes (`useMetrics`, igual hook que W2). Los dos
  contadores de guardia son 403 para quien no modera/no es la guardia
  (`analista`, `dinamizador`, `referente`): un 403 se traduce a
  `count: null` y la tarjeta correspondiente se oculta (no es un error
  de página), cualquier otro fallo sí queda como `isError`.
- **Personas** (`personas/page.tsx` → `PersonasTable`, hook `usePeople`):
  tabla paginada (20/página, DRF estándar) con filtros `comunidad`
  (UUID), `referente` (id), «participación desde» (`active_since`), «de
  alta desde» (`joined_since`) y búsqueda; cada fila enlaza a la ficha.
  Periodo fijo al mes en curso (sin selector: el brief no lo pedía para
  esta página).
- **Ficha de persona** (`personas/[userId]/page.tsx` → `PersonSheet`,
  hook `usePerson`): alias, foto, alta, referente, comunidades de la
  entidad, actividades del periodo con `attendance_status` y próxima
  actividad. **Nunca** email/teléfono/documentos/notas — no están en
  `PersonDetail` (invariante 9), así que no hace falta ocultar nada a
  mano, solo no inventarse un campo que el tipo no tiene. Botón
  «Asignar referente» (`useAssignReferent`, `POST .../references/`)
  solo si `membership.role` es `titular`/`moderador`. Un `referente` sin
  `Reference` hacia esa persona recibe **404** del backend (no 403, ver
  «Desviaciones» de la tarea): `usePerson` traduce 403 y 404 por igual a
  `PersonError('sin_acceso', …)`, y la página pinta el estado «Sin
  acceso» que pide la tarea sea cual sea el código real.
- **Actividades** (`actividades/page.tsx` → `ActividadesTable`, hook
  `useEntityEvents`): lista por periodo (mes en curso) con filtro de
  estado, inscritos/asistió/no asistió y responsable (`null` si quien
  mira no tiene `ver_lista_nominal` — el componente no rellena nada,
  solo pinta «—»). Cada fila enlaza a `asistencia/{eventId}`.
- **Asistencia** (`asistencia/page.tsx` reutiliza `ActividadesTable`
  como selector de actividad; `asistencia/[eventId]/page.tsx` →
  `AttendanceView`): lista nominal de asistentes (`useAttendees`, **array
  plano** — ver mismatch más abajo) con «Marcar asistió»/«Marcar no
  asistió» (`useMarkAttendance`, `POST .../attendance/ {user_id,
  attended}`, exige que la actividad ya haya empezado) y una caja de
  check-in por QR (`useCheckin`, `POST .../checkin/ {token}`): admite
  pegar el token o el `qr_payload` completo (`popyplan://checkin/<token>`,
  se extrae con una regex) y, si `window.BarcodeDetector` existe, un
  botón «Escanear con la cámara» que abre `getUserMedia` y decodifica
  fotograma a fotograma. Idempotente: `already: true` se pinta como
  aviso, no como error; 409 (fuera de la ventana `-2h..+12h`) muestra el
  mensaje del contrato tal cual.

**Mismatches encontrados entre `docs/schema.yaml` y el comportamiento
real** (verificados leyendo `panel/viewsets.py`/`events/viewsets.py` en
el repo backend, no solo el esquema): `GET .../people/` es paginada de
verdad (`_PaginacionPersonas`, `docs/PANEL.md` §3.2) aunque el esquema
la marque como array plano (`@extend_schema` sin envoltorio de
paginación) — `lib/api/types.ts::PaginatedPersonRowList` es un tipo
manual. `GET .../attendees/` es un array plano de verdad
(`Response(AttendeeSerializer(..., many=True).data)`, sin paginador)
aunque el esquema la marque como `PaginatedAttendeeList` (spectacular
envuelve por el `pagination_class` del `ViewSet`, sin mirar si la acción
pagina de verdad). `POST .../attendance/` y `POST .../checkin/`
responden `{user_id, status}` y `{status, already}` respectivamente
(`docs/PANEL.md` §4.3), no `EventDetail` como dice el esquema (los
`@extend_schema` de esas acciones no declaran `responses=`). Los tres
tipos de respuesta reales están a mano en `lib/api/types.ts`
(`AttendanceMarkResponse`, `CheckinResponse`) en vez de tomados de
`types.generated.ts`.

**Regla «sin datos de contacto» (invariante 9):** ninguna vista de
`personas`/`asistencia` puede mostrar `email`, `phone`, `birth_date`,
`document*` ni notas libres. Hoy se cumple porque ningún tipo del panel
que representa a una persona de la entidad (`PersonRow`, `PersonDetail`,
`Attendee.user` = `UserProfile`) tiene esos campos — quien añada un
campo nuevo a la ficha o a la lista de asistentes debe comprobar primero
que el tipo de `docs/schema.yaml` no los lleva, nunca confiar en que el
componente los vaya a filtrar a mano.

## Alta de personas: invitaciones e importación (tarea W3b)

`docs/PANEL.md` §3b: la entidad añade personas **por invitación**, nunca
creando la cuenta desde el panel (invariante 3). En Personas
(`personas/page.tsx` → `PersonasTable`), solo `titular`/`moderador`
(`canManage`, calculado en el Server Component igual que en
`recursos/page.tsx`) ven los botones «Añadir persona»
(`components/people/AddPersonDialog.tsx`, hook `useInvite`) e «Importar
Excel/CSV» (`components/people/ImportPeopleDialog.tsx`, hook
`useImportPeople`); el resto de roles con acceso a la página
(`dinamizador`, `referente`) no los ve. `AddPersonDialog` pide nombre,
email (obligatorio, validado con una expresión regular en el cliente —
sin `required`/`pattern` nativos para no depender de la validación de
restricciones del navegador, así el mensaje de error lo decide siempre
el propio componente), teléfono, comunidad (select de
`useEntityCommunities`) y referente (select de `useOrgMembers` filtrado
a `role === 'referente'`, etiquetado «Persona n.º `<user_id>`» porque
`OrgMembership` no lleva nombre de cuenta, invariante 1/9 — mismo
criterio que `PersonSheet.tsx::AssignReferentForm`); un 409 del backend
(correo ya miembro activo) se traduce literalmente a «Esta persona ya es
miembro de la entidad»; el éxito deja un aviso «Invitación enviada a
`<email>`.» dentro del propio diálogo (no hay componente de toast en el
panel, mismo patrón que `lastSent` en `ComunicacionesPanel.tsx`).

`ImportPeopleDialog` sube un `.csv`/`.xlsx` (límite propio de 5 MB antes
de subir, `lib/people/validateImportFile.ts`, mismo patrón que
`lib/resources/validateFile.ts`) con un enlace «Descargar plantilla»
(`public/plantilla-personas.csv`, cabecera
`nombre;email;telefono;comunidad;referente_email` y una fila de
ejemplo). Flujo en dos pasos con `useImportPeople`
(`POST .../invitations/import/?dry_run=`): primero `dry_run=true`
(vista previa con creadas/reenviadas/ya-miembros y una tabla de errores
por fila con `{row, email, error}`), luego, si la persona confirma,
`dry_run=false` (import real) — dos llamadas a la mutación con el mismo
fichero, distintas solo en `dryRun`. Errores en la vista previa **no**
bloquean confirmar: el aviso lo dice explícitamente («las filas con
error no se importarán; el resto de filas válidas se puede confirmar
igual»).

**`usePeople` con `include_invited`** (`docs/PANEL.md` §3b.7): el
checkbox «Incluir invitadas» de `PersonasTable` pasa
`includeInvited: true` a `usePeople`, que añade `?include_invited=true`
a la query — el propio backend mezcla filas `InvitedPersonRow`
(`{invitation_id, display_name, status: 'invited', invited_at}`) al
final de cada página junto a las `PersonRow` normales; `PaginatedPersonRowList.results`
es ahora `PersonListRow[]` (`PersonRow | InvitedPersonRow`,
`lib/people/invitedRow.ts::isInvitedPersonRow` decide cuál es cuál por
la presencia de `invitation_id`, el único campo que no comparten). Una
fila invitada se pinta con una insignia «Invitada (pendiente)», su
`display_name` y `invited_at` en la columna «De alta»; el resto de
columnas (comunidades, actividades, referente) van con «—» porque no
hay persona todavía. Solo `canManage` ve la columna «Acciones»
(«Reenviar», `useResendInvitation`, sin confirmación por no ser
destructiva; «Revocar», `useRevokeInvitation`, con `ConfirmDialog` por
ser irreversible). **Decisión de esta tarea:** `useInvitations`
(`GET .../invitations/`) no duplica ese listado — se usa solo para el
recuento de invitaciones `pending` que se muestra junto al checkbox
(`PersonasTable::PendingInvitationsHint`, montado solo mientras el
checkbox está activo, igual que `ResourceForm` dentro de
`RecursosPanel.tsx` solo llama a sus mutaciones mientras el formulario
está montado) — así no hay dos fuentes de verdad para las mismas filas.

## Comunicaciones, encuestas y recursos (tarea W4b)

`docs/PANEL.md` §5 (comunicaciones oficiales), §6 (encuestas) y §7
(biblioteca de recursos). Reemplaza los avisos «Próximamente» que dejó
W4a para estas tres secciones — Familias sigue aparcada
(`components/ui/ComingSoon.tsx`, `lib/auth/entidadMenu.ts::PENDING_SECTIONS`)
hasta que el backend tenga el espacio de familias (P6).

- **Comunicaciones** (`comunicaciones/page.tsx` → `ComunicacionesPanel`,
  hooks `useAnnouncements`/`useSendAnnouncement`): redactar un anuncio
  (título, cuerpo, audiencia `members`/`community:<uuid>`/`families`) e
  historial con `recipients_count`. La opción «Familias» va deshabilitada
  con la pista «Disponible cuando exista el espacio de familias»
  (`audience='families'` responde 400 en el backend hasta P6, §5.2). El
  backend no ofrece una vista previa del número de destinatarios antes de
  enviar (no hay endpoint para eso): el diálogo de confirmación
  (`components/ui/ConfirmDialog.tsx`, nuevo) describe la audiencia elegida
  en vez de un recuento, y tras el envío se pinta el `recipients_count`
  real de la respuesta. Solo `titular`/`moderador` ven el formulario de
  redacción (`canCompose`); el resto de roles con acceso a la página solo
  ve el historial — hoy eso no llega a probarse a través del menú, porque
  ningún rol que vea la sección en `entidadMenuFor` deja de poder
  componer (ver más abajo), así que el camino de solo lectura del
  componente tiene su propio test directo
  (`components/entidad/ComunicacionesPanel.test.tsx`) en vez de uno a
  través de la página.
- **Encuestas** (`encuestas/page.tsx` → `EncuestasPanel`, hook
  `useSurveys`/`useCreateSurvey`; `encuestas/[surveyId]/page.tsx` →
  `SurveyResultsView`, hook `useSurveyResults`): lista (título, tipo
  `Periódica`/`Post-actividad`, estado abierta/cerrada calculado en el
  cliente con `isSurveyOpen` a partir de `opens_at`/`closes_at`, número de
  preguntas) con enlace a resultados; crear encuesta periódica (título,
  fechas, preguntas `stars_1_5`/`scale_4`/`text_short` con orden) — las
  `post_event` las crea el backend solo al completar una actividad (§6.3),
  esta página no ofrece crearlas a mano. Resultados: por pregunta media +
  distribución (barras con `recharts`, mismo patrón que
  `components/metrics/SeriesChart.tsx`) para `stars_1_5`/`scale_4`, lista
  sin orden para `text_short`; con menos de `PANEL_MIN_GROUP_SIZE`
  respuestas la pregunta llega `suppressed: true` y se pinta como «<5»
  (nunca vacío). **Banner explícito de anonimato**: la cadena literal
  «Las respuestas son anónimas y agregadas.» se pinta siempre al principio
  de la página de resultados, sea cual sea el estado de la consulta
  (cargando, error o con datos) — es la única fuente de esa cadena en el
  código (`SurveyResultsView.tsx::ANONYMITY_BANNER`); quien toque esa
  página no debe reformularla ni moverla a un lugar condicional. Solo
  `titular`/`moderador` crean encuestas (`canCreate`); el resto de roles
  con acceso (`dinamizador`, ver más abajo) solo ve la lista y los
  resultados.
- **Recursos** (`recursos/page.tsx` → `RecursosPanel`, hooks
  `useResources`/`useCreateResource`/`useUpdateResource`/`useDeleteResource`):
  lista agrupada por categoría (`help`, `training`, `families`, `habits`,
  `activities`, `about`) conservando el orden que ya llega del backend
  (`is_featured` descendente y luego `created_at` descendente) dentro de
  cada grupo; crear/editar con campos según `kind` (`body` para `text`,
  `url` para `link`, fichero para `pdf`/`video`/`audio`/`document`);
  borrar con `ConfirmDialog`. Ficheros: validación en el cliente antes de
  intentar la subida (`lib/resources/validateFile.ts::validateResourceFile`,
  mismos límites que `panel.services.resources.validate_file` en el
  backend: 20 MB, extensiones `pdf`/`mp4`/`mp3`/`docx`/`png`/`jpg`) — el
  backend valida otra vez de todos modos (nunca hay que confiar solo en
  el cliente), y su 400 se muestra igual si llega. La audiencia
  «Familias» va deshabilitada en el formulario con la misma pista que
  Comunicaciones (un recurso `audience='families'` hoy no es visible para
  nadie salvo quien gestiona la entidad, §7.2 — marcador de posición hasta
  P6). Solo `titular`/`moderador` gestionan (`canManage`); el resto de
  roles con acceso solo ve la lista.

**Subida de fichero (multipart)**: `hooks/useCreateResource.ts` y
`useUpdateResource.ts` construyen el cuerpo con
`lib/resources/resourceFormData.ts::buildResourcePayload` — si hay
fichero, un `FormData`; si no, un objeto JSON plano (más fácil de
testear, y el backend acepta ambos según `docs/schema.yaml`). Para que
`lib/api/client.ts::apiFetch` pudiera mandar ese `FormData` tal cual (sin
`JSON.stringify` ni forzar `Content-Type: application/json`, que rompería
el `boundary` multipart que pone el navegador), se le añadió detección de
`FormData` en `rawRequest` — cambio mínimo y compatible con todo lo que
ya lo usaba (`lib/api/client.test.ts` tiene el caso nuevo).

**Menú de `dinamizador` (decisión de esta tarea, pregunta 19 del informe
de W4a)**: `lib/auth/entidadMenu.ts::PENDING_SECTIONS` pasa de
`[comunicaciones, encuestas, recursos, familias]` a solo `[familias]` —
Encuestas y Recursos ya tienen página real, así que `dinamizador`
recupera su matriz original documentada en el propio fichero («todo
salvo Configuración, Reportes y Comunicaciones»: nunca excluía Encuestas
ni Recursos, el parche de W4a las ocultaba solo para no dar 404).
Comunicaciones sigue oculta para `dinamizador` porque esa matriz original
sí la excluye explícitamente, y coincide con el contrato: `POST` solo
admite `titular`/`moderador`, sin otra acción útil para ese rol en la
página. Familias permanece oculta (sin página real todavía).

## Área de plataforma: Inicio, Entidades, Reportes, Ayuda, Verificaciones, Roles, Auditoría (tarea W5)

`docs/SEGURIDAD_Y_MODERACION.md` (§1 roles de plataforma, §4 reportes,
§5 ayuda, §7 verificación, §8 organizaciones) y `docs/PANEL.md` (§1
métricas de plataforma, dashboard-stats). Páginas bajo `app/plataforma/`,
Server Component con sesión + `plataformaMenuFor(role)` (redirect si no
está en el menú de ese rol → `EmptyState` «Sin acceso»; el layout ya
filtra el propio menú lateral con la misma función).

**Matriz de visibilidad** (`lib/auth/plataformaMenu.ts::plataformaMenuFor`,
sacada del permiso real de cada endpoint, no inventada): `superadmin` ve
las 8 secciones; `verifier` solo Inicio/Entidades/Verificaciones
(`organization-list/create/verify` y `verification-review-*` piden
`verifier`/`superadmin`); `moderator` y `support` ven Inicio/Reportes/
Ayuda/Métricas (`safety/services/reports.py::queue` y
`PlataformaMetricsView` admiten `moderator`/`superadmin`/`support`, nunca
`verifier`); Auditoría es solo `superadmin` en los cuatro roles.

- **Inicio** (`page.tsx` → `PlataformaHomeDashboard`): tarjetas de `GET
  /api/admin/dashboard-stats/` (usuarios activos, actividades
  programadas — `IsAdminUser`/`is_staff`, que hoy solo tiene
  `superadmin`; `hooks/useDashboardStats.ts` traduce un 403 a `null` y
  la tarjeta se oculta, igual que el resto de contadores tolerantes del
  panel), reportes pendientes (`useReportsQueue(undefined, {status:
  'pending'})`, cola global) y solicitudes de ayuda pendientes
  (`usePlatformPendingHelpRequests`, ver el hueco de contrato más abajo)
  — ambas ocultas si esa sección no está en el menú del rol — y
  entidades verificadas/pendientes (`useOrganizations`, abierto a
  cualquier autenticado).
- **Entidades** (`entidades/page.tsx` → `EntidadesTable` + «Nueva
  entidad» → `NuevaEntidadDialog`, `hooks/useOrganizations.ts`): listado
  paginado con filtros `verified`/`search` (`parent` no tiene selector en
  la lista, solo se usa para «hijas» en la ficha); alta
  (`POST /api/organizations/`, `verifier`/`superadmin`, nace sin
  verificar). **Ficha** (`entidades/[id]/page.tsx` → `EntidadDetail`,
  seis secciones con un simple selector de botones, mismo patrón que el
  `group_by` de `PlataformaMetricsDashboard` — sin ARIA tabs, el panel no
  tenía ese patrón todavía): Datos (lectura + «Verificar»,
  `verifier`/`superadmin`), Paraguas (cambiar `parent`, solo
  `superadmin`, más lista de hijas), Ámbito (ampliar `scope`, solo
  `superadmin` desde plataforma — el titular lo hace desde su propia
  entidad), Equipo (alta/baja de `OrgMembership` y referencias),
  Métricas (`useMetrics('entidad', orgId, …)`) y Comunidades y
  actividades (recuentos). **Límite de contrato documentado in situ**:
  Equipo y Métricas normalmente devuelven 403 para la plataforma —
  `entities/permissions.py::puede` y `PuedeEnEntidad('ver_panel')` solo
  miran `OrgMembership`, sin excepción para roles de plataforma; se
  muestran de todos modos (con un aviso «Sin acceso» explícito, nunca
  fingiendo datos) por si la plataforma además tiene membresía propia en
  esa entidad.
- **Reportes** (`reportes/page.tsx` → `ReportesQueuePlataforma`,
  `reportes/[reportId]/page.tsx` → `ReporteDetail` reutilizado del panel
  de entidad con la prop nueva `readOnly`): cola global
  (`useReportsQueue(undefined, filters)` — el hook ahora admite `orgId`
  opcional, sin romper al panel de entidad, que siempre lo pasa),
  columna «Entidad» (`Entidad #<id>`/`Global`, sin nombre — no hay
  `GET /api/organizations/{id}/` en lote, y resolverlo uno a uno por
  fila sería una petición por reporte listado; documentado como mejora
  futura) y una insignia «Escalado» (`escalated_at`). El detalle admite
  asignar/resolver/escalar igual que en la entidad, **ocultas** cuando
  `readOnly` (`support`: `can_view` sin `can_act`,
  `safety/services/reports.py`).
- **Ayuda** (`ayuda/page.tsx` → `AyudaPendienteList`,
  `hooks/usePlatformPendingHelpRequests.ts`): **hueco de contrato**
  documentado en el propio hook — `GET
  /api/safety/help-requests/pending/` exige `?organization=<id>` y solo
  autoriza a la guardia de esa entidad o a su `titular`/`moderador`
  (`safety/viewsets.py::HelpRequestViewSet.pending`); **ningún** rol de
  `PlatformRole` pasa esa comprobación por sí solo. El hook recorre todas
  las entidades (`useOrganizations`, todas las páginas) y pide `pending`
  de cada una, tolerando 403/400 por entidad — en la práctica, para
  quien solo tiene rol de plataforma sin `OrgMembership` en ninguna
  entidad, la lista queda vacía casi siempre. Ver pregunta de diseño en
  `docs/preguntas-diseno.md` (sección «Task W5»): falta una ruta
  agregada de plataforma para esto, análoga a `report-queue` sin
  `organization`.
- **Verificaciones** (`verificaciones/page.tsx` → `VerificacionesQueue`,
  `hooks/useVerificationReviewsQueue.ts`/`useDecideVerificationReview.ts`):
  cola `pending` de `VerificationReview` con el recurso de la persona
  (`appeal_text`) y el motivo del proveedor (`reason`); aprobar/rechazar
  con nota (`verifier`/`superadmin`).
- **Roles** (`roles/page.tsx` → `RolesPanel`, `hooks/usePlatformRoles.ts`):
  lista de `PlatformRole` vigentes, conceder (buscador de cuentas por
  email/usuario vía `GET /api/users/users/?search=` —
  `hooks/useUserSearch.ts`, `IsAdminUser`, hoy solo `superadmin` la usa
  y solo `superadmin` llega a esta página, así que en la práctica
  siempre funciona; un 403 cae a lista vacía en vez de romper el
  formulario, con el id de usuario como alternativa siempre disponible)
  y revocar con `ConfirmDialog` (acción de alto impacto: quita acceso a
  la plataforma).
- **Auditoría** (`auditoria/page.tsx` → `AuditoriaPanel`,
  `hooks/useAuditLog.ts`): filtros `actor`/`action`/`target_type`/
  `target_id`/`since`/`until`, tabla con `metadata` legible (`clave=valor`
  por entrada) y exportación CSV **del cliente** (la página actual, no
  auditada por sí misma — una exportación auditada de todo el listado
  es una ruta de backend aparte, fuera del alcance de esta tarea).
  **Pendiente de backend al escribir esta tarea**: `GET
  /api/safety/audit/` (`AuditLogViewSet`, tarea P6 del backend) existía
  ya en el árbol de trabajo del backend pero sin commitear y sin
  documentar en `docs/PANEL.md` — se integró contra la forma confirmada
  leyendo directamente `safety/serializers.py::AuditLogSerializer`
  (`{id, actor: {id, public_name}, action, target_type, target_id,
  metadata, ip?, created_at}`, filtros `actor/action/target_type/
  target_id/since/until`), con el hook y los tipos documentando esa
  procedencia (`lib/api/types.ts::AuditLogEntry`). Si el contrato final
  cambia al documentarse en `docs/PANEL.md`, revisar
  `hooks/useAuditLog.ts` y `lib/api/types.ts` primero.

## Diseño de sesión (refresh real desde la tarea W3)

Access token en memoria (`lib/auth/tokenStore.ts`, nunca localStorage).
Desde W3 el backend expone un refresh token de verdad
(`docs/PANEL.md` §0): la cookie httpOnly `pp_session`
(`lib/auth/cookie.ts::SESSION_COOKIE_NAME`) guarda **el refresh**, nunca
el access — 30 días de vida, `ROTATE_REFRESH_TOKENS=True` +
`BLACKLIST_AFTER_ROTATION=True` (cada uso lo rota y deja el anterior en
lista negra).

- `POST /api/session` (login): pone el refresh en la cookie; el access
  viaja en el cuerpo para que `hooks/useAuth.ts` lo guarde en memoria.
- `POST /api/session/refresh`: cambia el refresh de la cookie por un
  access nuevo llamando a `POST /api/auth/token/refresh/`, guarda el
  refresh rotado y devuelve datos frescos (`GET .../me/` +
  `.../platform-roles/me/`). Lo llama `lib/api/client.ts` tras un 401
  (reintenta una vez; si falla, logout) y `hooks/useAuth.ts::restoreSession`
  al arrancar la app.
- `DELETE /api/session` (logout): invalida el refresh en el backend
  (`POST /api/auth/logout/ {refresh}`, best-effort) y borra la cookie.

**`middleware.ts` (pieza nueva de W3, imprescindible):** un Server
Component (`lib/auth/session.ts::getServerSession`, usado por los tres
layouts de área) no puede escribir cookies — si intentara refrescar él
mismo, el refresh rotado se perdería y la sesión moriría en la
siguiente petición (el anterior ya está en lista negra). El middleware
(`matcher`: `/entidad/**`, `/paraguas/**`, `/plataforma/**`,
`/elegir-entidad`) hace el refresco una vez por navegación, rota la
cookie, y pasa el access token a la petición como cabecera interna
(`ACCESS_TOKEN_HEADER = 'x-pp-access-token'`, nunca llega al navegador)
que `getServerSession` lee con `headers()` de `next/headers`. Sin
cookie, o si el backend rechaza el refresh, el middleware la borra y
deja pasar sin cabecera — `getServerSession` devuelve `null` y el
layout/página redirige a `/login`, igual que antes.

`lib/api/serverFetch.ts` (servidor) no reintenta nunca — quien llama
decide (`redirect('/login')`).

## Comandos

- `npm run dev` / `npm run build` / `npm run start`
- `npm run typecheck` (`tsc --noEmit`)
- `npm run lint` (ESLint + `eslint-plugin-jsx-a11y` en modo `strict`)
- `npm run test` / `npm run test:coverage` (Vitest + Testing Library)
- `npm run gen:types` — regenera `lib/api/types.generated.ts` desde
  `../popyplan/docs/schema.yaml` (`openapi-typescript`); se commitea.
- `npm run e2e` (Playwright; ver `e2e/login.spec.ts`, en `test.skip`
  hasta que exista `seed_panel_demo` en el backend)

Verificación antes de cerrar cualquier tarea:
`npm run typecheck && npm run lint && npm run test:coverage && npm run build`.

## Cobertura

- Vitest mide líneas sobre `lib/**`, `hooks/**` y `app/**/*.ts` (route
  handlers y helpers; nunca `.tsx` de páginas/layouts/componentes, que se
  prueban por comportamiento, no por cobertura —
  `components/metrics/*.tsx` y `components/entidad/*.tsx` tampoco
  cuentan). Umbral con ratchet en `vitest.config.ts`
  (`coverage.thresholds.lines`): **100 % al cerrar W1, W2 y W3** (umbral
  fijado a 99.7, real menos 0.3); solo puede subir. Objetivo final del
  plan de cobertura: ≥98 % (ya superado aquí).
- Test de consumo portado del móvil
  (`lib/api/consumption.test.ts` + `lib/api/consumption-allowlist.json`):
  todo endpoint de `lib/api/endpoints.ts` se usa y tiene test; la
  allowlist de pendientes solo puede encoger (hoy `total: 0`).
- Cada página (`page.tsx`) y cada layout con lógica de rol tiene su
  `page.test.tsx`/`layout.test.tsx`: nunca solo snapshot, siempre
  aserciones de texto/acción con fixtures realistas
  (`test-utils/fixtures/*.ts`).
- `eslint-plugin-jsx-a11y` en `strict` desde el primer commit
  (accesibilidad: Fase 6 la audita formalmente, pero se cuida desde ya —
  `lang="es"`, foco visible, etiquetas de formulario).

## Convenciones

- Textos de UI en español; identificadores de código en inglés.
- Ramas: se trabaja en `develop`; al cerrar una tarea con CI verde,
  `main` se actualiza por fast-forward al mismo commit
  (`git push origin <sha>:main`), sin PR.
- Tokens de color: misma paleta que `popyplan-mobile/app/_theme/colors.ts`
  (`app/globals.css`, tokens Tailwind v4 vía `@theme`). Sin lenguaje
  visual nuevo; la tematización completa de marca blanca es Fase 6.
- Env: `NEXT_PUBLIC_API_URL` (`.env.example`; nunca commitear
  `.env.local`).
