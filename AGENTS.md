# AGENTS.md — Popyplan Panel

> Copia de `CLAUDE.md`: si actualizas uno, actualiza el otro (el contenido debe mantenerse idéntico salvo este encabezado).

Panel web de Popyplan (Next.js 15, App Router, TypeScript estricto,
Tailwind CSS 4, TanStack Query 5). Consume la misma API Django/DRF que
`~/Code/popyplan-mobile` (repo backend: `~/Code/popyplan`, Fase 5). Login
JWT contra el backend; sin servidor de datos propio.

## Qué es

Tres áreas por rol, cada una bajo su propia ruta:

- **`/entidad/[slug]`** — panel de una asociación/ONG/administración con
  rol de `OrgMembership` (`titular`, `moderador`, `dinamizador`,
  `analista`, `referente`). Menú de 14 secciones (Inicio, Personas,
  Comunidades, Actividades, Asistencia, Comunicaciones, Encuestas,
  Recursos, Familias, Programas, Reportes, Guardia, Informes,
  Configuración), con visibilidad por rol (`lib/auth/entidadMenu.ts`).
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

**Actualización (tarea W5, Fase 6): el campo sí llegó, pero con otro
nombre.** `users/profile_serializers.py::OrgMembershipRefSerializer` ya
expone `organization_type` (`source='organization.org_type'`) desde la
«ronda de cierre de Fase 5» — confirmado contra el backend seedeado
(`GET /api/users/users/me/` de `panel-analista-gfa@test.com` devuelve
`"organization_type": "administracion"`) y contra `docs/schema.yaml`
regenerado (`OrgMembershipRef.organization_type: string`, sin `org_type`).
El párrafo de arriba (y `lib/auth/area.ts::isParaguas`/
`lib/api/types.ts::OrgMembershipForArea`) siguen mirando `org_type`, un
nombre de campo que el backend nunca ha usado — la condición nunca se ha
cumplido ni se cumplirá tal cual está. **No se corrige en esta tarea**
(fuera del alcance de W5, y cambiar `resolveArea` cambia a qué URL
aterriza el login de cualquier `analista`/`titular` de una entidad
paraguas, con eco en `lib/auth/area.test.ts` y en el propio
`e2e/comparativa.spec.ts` de esta tarea, que sigue navegando a mano a
`/paraguas/...` por si acaso): el fix real es de una línea
(`membership.organization_type === "administracion"` en
`isParaguas`, y renombrar el campo opcional de `OrgMembershipForArea`),
documentado aquí para quien retome esta pantalla.

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
meses, plurianual — ver «Comparativa entre ámbitos y memoria plurianual»
más abajo) y valida `since<=until` y ≤1461 días (misma regla que el
backend, `PERIODO_MAX_DIAS`); `lib/metrics/format.ts` formatea. `hooks/useExport.ts` hace el
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
W4a para estas tres secciones — Familias siguió aparcada
(`lib/auth/entidadMenu.ts::PENDING_SECTIONS`) hasta que el backend tuvo
el espacio de familias (P6); ver «Familias» más abajo (ronda final de
Fase 5) para su cierre — `components/ui/ComingSoon.tsx` ya no existe,
retirado en esa misma tarea al quedarse sin ninguna sección que pintar.

- **Comunicaciones** (`comunicaciones/page.tsx` → `ComunicacionesPanel`,
  hooks `useAnnouncements`/`useSendAnnouncement`): redactar un anuncio
  (título, cuerpo, audiencia `members`/`community:<uuid>`/`families`) e
  historial con `recipients_count`. La opción «Familias» iba deshabilitada
  con la pista «Disponible cuando exista el espacio de familias»
  (`audience='families'` respondía 400 en el backend hasta P6, §5.2) —
  ya habilitada condicionalmente, ver «Familias» más abajo. El
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
  «Familias» iba deshabilitada en el formulario con la misma pista que
  Comunicaciones (un recurso `audience='families'` no era visible para
  nadie salvo quien gestiona la entidad, §7.2) — ya habilitada
  condicionalmente, ver «Familias» más abajo. Solo `titular`/`moderador`
  gestionan (`canManage`); el resto de roles con acceso solo ve la lista.

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
página. Familias permaneció oculta hasta la ronda final de Fase 5
(siguiente sección): `PENDING_SECTIONS` está vacía desde entonces.

## Familias (ronda final de Fase 5, cierre de P6)

`docs/PANEL.md` §8 («POP Familias»): espacio separado de la entidad, sin
cuenta especial ni vínculo familiar↔persona en la base de datos
(invariante 1 — nadie declara ser familiar de nadie). Reemplaza el
«Próximamente» de W4a; sale de `PENDING_SECTIONS`
(`lib/auth/entidadMenu.ts`), así que `dinamizador` la recupera igual que
Encuestas/Recursos en W4b — visible a titular/moderador/dinamizador,
oculta a analista/referente (no estaba en sus matrices y sigue sin
estarlo, `docs/PANEL.md` §8.3 no distingue rol dentro de `ver_panel` pero
el brief tampoco lo pedía para esos dos).

- **Página** (`familias/page.tsx` → `FamiliasPanel`, hook
  `useFamiliesSummary`, `GET /api/panel/entidad/{org_id}/families/`):
  tarjetas de resumen (comunidades de familias, personas, próximas
  actividades), listado de esas comunidades con badge de personas y de
  cruce de espacios, próximas actividades, comunicaciones y recursos
  recientes con enlace a sus propias secciones (`/comunicaciones`,
  `/recursos`, `/actividades`). Banner explícito, misma cadena literal
  que pide el brief: «Las comunidades de familias están separadas de las
  de miembros; nadie declara ser familiar de nadie.» — se pinta siempre,
  sea cual sea el estado de la consulta con datos.
- **Regla de supresión de `members_count`**: un fix de backend que llegó
  en paralelo a esta tarea puede suprimir el recuento de personas
  (`null` + `suppressed: true`) para quien no tiene `ver_lista_nominal`
  en la entidad — al escribir esta tarea `docs/schema.yaml` todavía
  documentaba `FamiliesSummary.members_count`/`FamilyCommunityRow
  .members_count` como `number` a secas, así que `lib/api/types.ts`
  amplía ambos a mano a `number | null` con un `suppressed?` opcional
  (mismo patrón que `PeopleMetrics`, sin esperar a regenerar
  `types.generated.ts`). Se pinta con `formatCount` (`lib/metrics/format.ts`,
  reutilizado tal cual): cualquier `members_count: null` se trata como
  suprimido (`<5`) lleve o no el campo `suppressed` explícito, porque en
  este endpoint no hay otra razón para que llegue `null`.
- **Cruce de espacios** (`allow_cross_space`, §8.1): interruptor por
  comunidad, solo titular/moderador (`canManage`, calculado en el Server
  Component igual que en Recursos/Comunicaciones) — `dinamizador` ve el
  estado (badge «Espacios separados»/«Cruce de espacios activado») sin el
  control. Activarlo o desactivarlo pide confirmación
  (`components/ui/ConfirmDialog.tsx`) que explica la regla de separación
  antes de mandar `PATCH /api/communities/{id}/ {allow_cross_space}`
  (`hooks/useToggleCrossSpace.ts`); invalida el resumen de Familias y el
  listado general de comunidades de la entidad al tener éxito.
- **«Nueva comunidad de familias»** (`hooks/useCreateFamiliesCommunity.ts`,
  `POST /api/communities/ {name, description?, visibility?,
  code_of_conduct?, space:'families', owner_org}`): mismo endpoint
  general de comunidades que `ComunidadesPanel.tsx` (§8.1: solo una
  comunidad con `owner_org` puede marcarse `families`, y el espacio no se
  puede cambiar después de crearla). Solo titular/moderador; diálogo con
  nombre, descripción, visibilidad (abierta/con solicitud/privada) y
  código de conducta, mismo patrón de `Dialog.tsx` que
  `AddPersonDialog.tsx`.
- **Comunicaciones y Recursos, audiencia «Familias»** (`docs/PANEL.md`
  §5.2/§7.2, ya operativa desde P6): `ComunicacionesPanel.tsx`/
  `RecursosPanel.tsx` calculan `hasFamilies` a partir de
  `useEntityCommunities` (`space === 'families'`) y solo entonces
  habilitan la opción — sin ninguna comunidad de familias en la entidad,
  se queda deshabilitada con la misma pista de siempre («Disponible
  cuando exista el espacio de familias»/«estará disponible cuando exista
  el espacio de familias»).
- **`components/ui/ComingSoon.tsx` retirado**: Familias era la última
  sección que lo usaba; se borró en vez de dejarlo como código muerto.

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

## Cierre del panel: accesibilidad, e2e contra el backend real y CI (tarea W6)

### Carry-overs cerrados

- **Informes de entidad** (`app/entidad/[slug]/informes/page.tsx`,
  pregunta 18 de `docs/preguntas-diseno.md`): reutiliza
  `components/metrics/ExportPanel.tsx` con `scope="entidad"` (mismo
  componente que `paraguas/[slug]/informes`). Visible en el menú solo
  para `titular`/`moderador`/`analista` (`docs/PANEL.md` §2.1,
  `exportar_informes`); se encontró de paso que `dinamizador` la veía
  sin poder exportar — añadido a `DINAMIZADOR_HIDDEN`.
- **Columna «Entidad» de la cola de reportes con nombre**:
  `ReporteDetail.tsx`/`ReportesQueuePlataforma.tsx` pintan ahora
  `organization_display.name` (P7 lo añadió a `Report`/`ReportDetail`,
  `docs/PANEL.md` §10.3) en vez de «Entidad #`<id>`».
- **Ayuda de plataforma agregada de verdad**
  (`hooks/usePlatformPendingHelpRequests.ts`): una sola llamada a
  `GET /api/safety/help-requests/pending/` sin `organization` (P7,
  `docs/PANEL.md` §10.1) en vez de recorrer todas las entidades
  (N+1 peticiones, huella de la pregunta 26).
- **Ficha, pertenencia y referente en los avisos de ayuda** (fix
  posterior a W6): `HelpRequest.user_display` gana `is_member` y
  `referent: {id, public_name} | null` (`lib/api/types.ts
  ::HelpRequestUserDisplay`, tipo manual mientras el backend no lo trae
  en `types.generated.ts`). `GuardiaPanel.tsx` enlaza el nombre a
  `/entidad/{slug}/personas/{userId}` solo si `is_member`; si no, badge
  «No pertenece a la entidad» y el texto «Se apuntó a la actividad sin
  ser miembro.» — sin enlace, para no aterrizar en una ficha 404/«Sin
  acceso» de alguien sin membresía. `AyudaPendienteList.tsx` pinta el
  mismo badge (sin enlace: no conoce el slug de cada fila) y, en ambos,
  «Referente: `<public_name>`» cuando lo hay. Los dos listan además una
  línea fija bajo los avisos: «Popyplan no guarda teléfonos: contacta con
  la persona por el chat de la app o a través de su referente.»
  (invariante 9, sin contacto directo en el panel).
- **Selects de referente con nombre**
  (`components/people/AddPersonDialog.tsx`,
  `components/entidad/PersonSheet.tsx::AssignReferentForm`): pintan
  `public_name` de `useOrgMembers` (P7 lo añadió a `OrgMembership`,
  `docs/PANEL.md` §10.3) en vez de «Persona n.º `<user_id>`» o un id a
  mano — cierra las preguntas 13 y 22. Lo mismo en las tablas de Equipo
  y Referencias (`ConfiguracionPanel.tsx`/`EntidadDetail.tsx`).
- **Atajo de plataforma en Equipo/Métricas**
  (`components/plataforma/EntidadDetail.tsx`): el aviso de «esto
  normalmente da sin acceso» de W5 se corrigió — desde P7,
  `superadmin`/`moderator` pasan de verdad (`docs/PANEL.md` §10.2,
  cierra la pregunta 27).
- **Supresión por celda, no por sección** (`lib/metrics/format.ts`,
  pregunta 11): `formatCount`/`formatPct` miran primero si `value` es
  `null`; con un valor real lo pintan aunque la sección venga marcada
  `suppressed`. Ningún sitio de llamada cambió.

### Bugs reales encontrados por el e2e contra el backend (no por unit tests)

Ninguno se veía en Vitest porque los tests mockeaban la forma de la
respuesta, nunca la pedían de verdad:

1. **`GET /api/safety/reports/queue/` no pagina, nunca lo hizo**
   (`docs/SEGURIDAD_Y_MODERACION.md` §4: «200 lista»,
   `safety/viewsets.py::ReportViewSet.queue`, un array plano). El panel
   llevaba desde W4a/W5 tratándola como `{count, next, previous,
   results}` — `ReportesQueue.tsx`/`ReportesQueuePlataforma.tsx`
   pintaban botones «Anterior»/«Siguiente» que nunca podían funcionar
   (el `?page=` no hacía nada) y `useEntityHome.ts::fetchOptionalCount`
   leía `.count` de un array (`undefined`, sin lanzar excepción: las dos
   tarjetas de guardia del Inicio de entidad nunca mostraron un
   recuento real). `e2e/plataforma.spec.ts` lo hizo saltar de verdad
   (`TypeError: Cannot read properties of undefined (reading
   'length')` al leer `.results` de un array). Arreglado en
   `hooks/useReportsQueue.ts` (tipo `ReportRow[]`, sin `page`),
   `fetchOptionalCount` (cuenta `.length`) y los dos componentes (sin
   paginación, con el recuento real).
2. **`<dl>` anidado en `EntityHomeDashboard.tsx`/`{Paraguas,Plataforma}
   MetricsDashboard.tsx`**: agrupaban varias `StatCard` (cada una ya su
   propio `<dl>`) dentro de otro `<dl>` — regla `definition-list` de
   `axe-core`, hallada por el primer `expect(await axe(container))
   .toHaveNoViolations()` que se escribió. El contenedor pasa a
   `<div>`; cada `StatCard` sigue siendo su propia lista de definición.
3. **`Card.tsx` pintaba su título en `<h3>`**: con un `Card` colgando
   directo de un `<h1>` de página (el caso más común), saltaba de nivel
   1 a 3 sin pasar por 2 (`heading-order` de `axe-core`). Pasa a
   `<h2>`, que nunca salta nivel venga de donde venga.
4. **La descarga de informes nunca lleva el nombre de fichero real**
   (`e2e/titular.spec.ts`, flujo de Informes): `pop/settings.py` no
   declara `CORS_EXPOSE_HEADERS`, así que `Content-Disposition` — donde
   viaja `popyplan-<slug>-<since>-<until>.csv` (`docs/PANEL.md` §2.2)
   — no es una cabecera "segura" por defecto y el navegador se la
   oculta a `fetch()` en una petición cross-origin (el panel en
   `:3000`/`:3100` contra el backend en `:8001`); `useExport.ts
   ::filenameFrom` cae siempre al nombre por defecto (`informe.csv`).
   **No es solo del test: pasa igual en el panel real.** Arreglarlo
   exige `CORS_EXPOSE_HEADERS = ['Content-Disposition']` en el repo
   backend — fuera de alcance de esta tarea (solo repo del panel); el
   test comprueba el comportamiento real (se descarga un `.csv`) y deja
   la causa documentada aquí y en el propio `e2e/titular.spec.ts`.

### Auditoría estática de bugs (2026-09, post-Fase 6)

Revisión completa del código propio (auth/sesión, cliente HTTP, hooks de
datos, métricas, componentes de entidad y plataforma) buscando fallos de
lógica que los mocks de Vitest no ejercitan. 22 fixes aplicados (3 altas,
9 medias, 10 bajas) + 2 hallazgos desmentidos con evidencia. Los más
relevantes:

- **Escaneo QR roto** (`AttendanceView.tsx`): el `<video>` solo existía con
  `scanning === true`, pero `srcObject` se asignaba antes del re-render —
  el detector nunca leía fotogramas y la cámara quedaba activa al navegar.
  Reescrito con `streamRef` + `attachStream()`; el cleanup suelta los
  tracks.
- **Carrera de refresco en el middleware** (misma clase que el bug 4 de la
  demo, pero en el servidor): sin single-flight, el perdedor de la carrera
  borraba la cookie de una sesión válida. Ver «Hardening de sesión» arriba.
- **`useAssignReferent`** invalidaba con `userId` number contra una query
  cacheada con string — idéntica clase que el bug de `useProgram`, instancia
  que quedó sin corregir entonces. Normalizado con `String(userId)`.
- **Filtro «Comunidad» de Personas** era texto libre contra un endpoint que
  solo acepta UUID (400 → ErrorState); ahora `<select>` de
  `useEntityCommunities`, como `AddPersonDialog`.
- **Equipo solo para `titular`**: la matriz real del backend
  (`entities/permissions.py`, `'equipo': {'titular'}`) dejaba a `moderador`
  una sección en 403 permanente; `ConfiguracionPanel` la oculta para ese
  rol. Hueco relacionado documentado: los selects de referente usan
  `useOrgMembers` (también solo-titular), así que un moderador los ve
  vacíos salvo «Sin referente».
- **`subtractMonths` rebalsaba el día 31** (`lib/metrics/period.ts`):
  `setMonth` saltaba de mes (31-may → trimestre desde el 3-mar). Ahora
  clampa al último día del mes destino (31-may → 28-feb), como `subMonths`
  de date-fns; los presets «trimestre»/«año» conservan el día cuando existe.
- **Errores de queries secundarias de los dashboards de métricas** se
  pintaban como «sin datos» (indistinguible de un periodo vacío); ahora
  `isError → ErrorState`, como la query base.
- **Tooltip de `SeriesChart`** respondía «<5» también para `null` no
  suprimido; ahora distingue (coherente con `formatCount`). Nota: recharts
  v3 omite las entradas `null` del tooltip, la distinción se testea a
  nivel unidad (`formatSeriesTooltipValue`).
- **`Escape` en `ConfirmDialog`** se saltaba el guard `pending` y cerraba el
  diálogo con la mutación en vuelo; ahora `onCancel` vía escape respeta
  `pending` como los botones.
- **Invalidación cruzada de «ack» de ayuda**: `useAcknowledgeHelpRequest` y
  su variante global invalidan ahora ambas claves (antes cada una dejaba la
  otra vista stale para quien tiene rol en entidad y plataforma).
- **Precedencia de paraguas en `resolveArea` documentada como decisión**:
  con ≥1 membresía paraguas se resuelve al paraguas (el primero del array)
  sin pasar por `/elegir-entidad`; fijado con tests en `lib/auth/area.test.ts`.

Hallazgos desmentidos (no había bug contra el contrato vigente):

- **Teléfono de guardia vacío**: enviar `""` **es** correcto — el backend
  declara `help_phone = CharField(blank=True, default='')` (no nullable) y
  DRF rechazaría `null` con 400. El audit sugirió `null`; verificado contra
  modelo/migración/schema antes de tocar nada.
- **`useOrgMembers` para moderador**: el «bug» era la UI mostrando Equipo a
  quien el backend no autoriza (fix arriba), no el hook.

### Accesibilidad

- `eslint-plugin-jsx-a11y` en `strict` desde W1 (`eslint.config.mjs`);
  0 avisos al cerrar la fase.
- `lang="es"` en `app/layout.tsx`; `<title>` único por página vía
  `export const metadata` de Next (plantilla `"%s · Popyplan"` en el
  layout raíz + un título propio por `page.tsx`, sacado de su `<h1>`
  cuando no colisiona con otra área — p. ej. «Inicio de la entidad» vs.
  «Inicio del paraguas» vs. «Inicio de plataforma»). El login
  (`app/(auth)/login/page.tsx`) se partió en un Server Component (el
  `<title>`) y `LoginForm.tsx` (cliente, `useState`/`useRouter`) porque
  un Client Component no puede exportar `metadata`.
- Enlace «Saltar al contenido» (`components/ui/SkipLink.tsx`,
  invisible hasta que recibe el foco) en los tres layouts de área,
  apuntando a `<main id="main-content" tabIndex={-1}>`.
- Diálogos (`components/ui/{Dialog,ConfirmDialog}.tsx`) atrapan el foco
  de verdad (`lib/a11y/useFocusTrap.ts`): foco inicial dentro del
  diálogo, `Tab`/`Shift+Tab` sin escapar, `Escape` cierra/cancela, el
  foco vuelve a donde estaba al cerrarse. Los dos ya llevaban
  `aria-modal="true"` desde que se escribieron.
- Tablas: todas con `<caption>` (casi siempre `sr-only`) o, la
  compartida `components/ui/Table.tsx`, con `caption` como prop
  obligatoria — no hay manera de añadir una tabla nueva sin una.
- Foco visible global: `:focus-visible { outline: 3px solid
  var(--color-primary-700); }` en `app/globals.css`, desde W1 (también
  cada `focus-visible:outline-*` puntual de un control, ver más abajo).
- **Marca legible (`primary-700`, tarea W1, Fase 6, decisión D1):**
  `--color-primary` (`#1fb3ae`, la marca de Popyplan, misma paleta que
  `popyplan-mobile/app/_theme/colors.ts`) queda **solo para superficies
  decorativas sin texto** (fondos de tarjeta, iconos grandes, `fill`/
  `stroke` de `recharts` en `SeriesChart.tsx`/`SurveyResultsView.tsx`).
  Todo texto, enlace, botón, borde de control con texto o foco visible
  usa `--color-primary-700` (`#0e7c78`, 5,0:1 sobre blanco) —
  sustitución completa de `text-primary`/`bg-primary`/`border-primary`/
  `outline-primary` por su variante `-700` en todo `app/` y
  `components/` (`grep -rn "text-primary\b\|bg-primary\b" app
  components` no debe encontrar nada). La cabecera de `/entidad/[slug]`
  y `/paraguas/[slug]` calcula el texto legible sobre el color de marca
  de la propia entidad con `lib/a11y/contrast.ts::readableOn` (blanco o
  `--color-secondary-900`, el que dé más ratio) y, si aun así el par no
  llegara a 3:1 (defensivo — no ocurre con esas dos opciones, ver el
  docstring de `readableOn`), cae al tinte `--color-primary-100` con
  texto `--color-text-base` y una franja de 6px del color de la entidad
  de borde inferior.
- **Contraste de los tokens de color** (`app/globals.css`), comprobado
  con un test automático (`lib/a11y/tokens.test.ts`, sobre
  `lib/a11y/contrast.ts::contrastRatio`) que lee el fichero real y falla
  si algún par baja de su umbral — ya no es una comprobación a mano:

  | Par | Ratio | AA texto normal (4.5:1) | AA texto grande/UI (3:1) |
  |---|---|---|---|
  | `text-base` / `background` | 19,8:1 | ✅ | ✅ |
  | `text-secondary` / `background` | 20,3:1 | ✅ | ✅ |
  | `text-form` / `background` (etiquetas) | 4,85:1 | ✅ | ✅ |
  | `error` / `background` (texto de error) | 5,46:1 | ✅ | ✅ |
  | `success` / `background` (texto de éxito) | 5,11:1 | ✅ | ✅ |
  | `text-inverse` / `secondary-900` (cabecera de plataforma) | 14,46:1 | ✅ | ✅ |
  | `text-base` / `border-light` (fondo de página) | 17,9:1 | ✅ | ✅ |
  | `text-inverse` / `primary-700` (botón primario, cabecera de entidad con color de marca) | 5,03:1 | ✅ | ✅ |
  | `primary-700` / `background` (enlaces, texto en `text-primary-700`) | 5,03:1 | ✅ | ✅ |
  | `text-base` / `primary-100` (tinte claro de cabecera, caso defensivo) | 16,93:1 | ✅ | ✅ |

  Los dos pares que fallaban AA antes de esta tarea (`text-inverse`/
  `primary` y `primary`/`background`, 2,59:1 cada uno) se resolvieron
  introduciendo `--color-primary-700` en vez de tocar `--color-primary`
  (D1: no diverge de la marca, solo aclara qué tono usar para texto). El
  token `--color-text-form-secondary` (1,86:1, sin uso real como texto)
  se eliminó de `app/globals.css` al no tener ningún consumidor.
- `axe-core` vía `vitest-axe` (`vitest.setup.ts` registra
  `toHaveNoViolations`; `test-utils/axe.ts` desactiva `region` —los
  tests de página renderizan solo el `page.tsx`, sin el `<nav>`/`<main>`
  del `layout.tsx`— y `color-contrast` —jsdom no calcula estilos
  computados reales; el contraste real se audita con el test automático
  de arriba, `lib/a11y/tokens.test.ts`, no con axe). Cada
  `page.test.tsx` cubierto tiene un test «no tiene violaciones de
  accesibilidad (axe)» como primer test del `describe`, con `render()`
  del propio `@/test-utils/render` para tener `container`:
  `app/(auth)/login`, `app/accesibilidad` (declaración pública, tarea
  W1), `entidad/[slug]` (Inicio), `entidad/[slug]/personas`
  (tabla + diálogo «Añadir persona» abierto, valida el foco atrapado),
  `entidad/[slug]/informes`, `entidad/[slug]/asistencia/[eventId]`
  (caja de check-in), `entidad/[slug]/encuestas/[surveyId]` (gráfico
  `recharts`), `entidad/[slug]/familias` (resumen + lista de comunidades,
  ronda final de Fase 5), `paraguas/[slug]` (Inicio), `plataforma` (Inicio),
  `plataforma/entidades` (tabla + diálogo «Nueva entidad» abierto),
  `plataforma/reportes/[reportId]`. **Excepción documentada**: el resto
  de páginas (`comunidades`, `actividades`, `reportes`, `guardia`,
  `configuracion`, `comunicaciones`, `encuestas`, `recursos`,
  `paraguas/[slug]/informes`, `plataforma/{auditoria,ayuda,verificaciones,
  roles,reportes,metricas,entidades/[id]}`) no llevan todavía su propio
  test de `axe` — la cobertura elegida es representativa de las tres
  áreas y de los patrones compartidos (tablas, diálogos con foco
  atrapado, gráficos, formularios), pero no exhaustiva; ampliarla es
  trabajo mecánico para quien retome accesibilidad en Fase 6.
- **Declaración de accesibilidad** (tarea W1, Fase 6): página pública
  `/accesibilidad` (`app/accesibilidad/page.tsx`, Server Component, sin
  sesión), conforme al RD 1112/2018 — alcance, situación de
  cumplimiento («parcialmente conforme» hasta cerrar la auditoría de
  esta fase), contenido no accesible (la misma excepción documentada
  arriba), preparación, contacto (`NEXT_PUBLIC_A11Y_CONTACT`, con
  fallback `accesibilidad@popyplan.com`) y procedimiento de aplicación.
  Enlazada desde `components/layout/Footer.tsx`, presente en el pie de
  los tres layouts de área y del login.

### E2E contra el backend real (`e2e/`)

`e2e/helpers.ts` centraliza login por API (`apiLogin`), resolución de
id de entidad por slug (`resolveOrgId`) y dos fixtures que la demo
sembrada no puede dar por sí sola porque sus fechas son relativas al
momento en que se sembró, no al momento en que corren los tests:

- `createCheckinFixture`: crea una actividad que empieza en 10 segundos
  (válida para `EventCreateSerializer.validate_starts_at`, que exige
  futuro) — su ventana de check-in (`starts_at - 2h`) ya está abierta
  al crearla — e inscribe a dos personas de calle de la demo
  (`panel-demo-asociacion-bidasoa-p01`/`p02@test.com`): una para el
  check-in por QR (con su token real de `my-checkin`), otra para
  «Marcar asistió» a mano.
- `escalateFirstPendingReport`: escala por API el primer reporte
  `pending` de una entidad — los reportes de la demo (Asociación
  Bidasoa) nunca aparecen en la cola *global* de plataforma mientras no
  estén escalados (`docs/SEGURIDAD_Y_MODERACION.md` §4), así que sin
  esto `e2e/plataforma.spec.ts` no tendría nada que abrir.

Specs: `login.spec.ts` (titular Bidasoa, y contraseña incorrecta →
mensaje del contrato), `titular.spec.ts` (Inicio → Personas → ficha →
Asistencia —marcar asistió + check-in por QR— → Informes, con
comprobación del nombre de fichero `popyplan-<slug>-<since>-<until>.csv`),
`analista.spec.ts` (métricas del paraguas + exportar PDF, con 503
tratado como salto documentado si WeasyPrint no está disponible),
`plataforma.spec.ts` (crear y verificar una entidad + abrir un reporte
escalado de la cola). Tarea W5 (Fase 6) añade cuatro specs más:
`accesibilidad.spec.ts` (`/accesibilidad` sin sesión; en `/login`, `Tab`
recorre email → contraseña → botón, con el foco siempre visible —
`getComputedStyle(document.activeElement).outlineStyle`), `programas.spec.ts`
(titular Bidasoa crea, activa y cierra un programa, y descarga su
informe CSV), `comparativa.spec.ts` (analista GFA ve la comparativa por
comarca del paraguas con alguna celda `<5`/`—` — el preset por defecto
«Este mes» no tiene actividad suficiente para que `compare_for` devuelva
ninguna fila en la demo sembrada, así que el spec cambia a «Año» antes
de comprobarlo) y `contratos.spec.ts` (superadmin crea un tramo de
precio y un contrato nuevo con él, para Asociación Bidasoa). Ninguno de
los cuatro necesita las fixtures de `helpers.ts` de arriba (fechas
fijas, sin ventana horaria que provocar).

**Hueco de contrato re-confirmado en esta tarea, con corrección**
(pregunta 3 de `docs/preguntas-diseno.md`): el login de la analista de
la diputación (`panel-analista-gfa@test.com`) sigue aterrizando en
`/entidad/gipuzkoako-foru-aldundia`, no en `/paraguas/...` — pero **no**
porque el backend no exponga el tipo de organización en
`org_memberships` (como decía esta nota hasta ahora): sí lo expone, como
`organization_type`, no como `org_type` (ver «Regla de paraguas» al
principio de este fichero, actualización de la tarea W5). `e2e/analista.spec.ts`
y `e2e/comparativa.spec.ts` (nuevo en esta tarea) navegan a la vista de
paraguas a propósito (`page.goto('/paraguas/gipuzkoako-foru-aldundia')`),
que sí funciona para esa cuenta (el gate de la página solo mira
membresía + rol, no el tipo de organización).

**Límite de peticiones del login, imprescindible saberlo**: `POST
/api/auth/login/` está limitado a **5 intentos por 60 segundos por
IP** (`users/rate_limiting.py::RATE_LIMIT_CONFIGS`, clave
`ip:<ip>:auth`, compartida entre todas las cuentas que inicien sesión
desde la misma IP — no es por cuenta). La suite completa de `e2e/`
hace más de 5 logins seguidos (fixtures por API + login de UI en cada
spec), así que en local hay que darle margen entre specs o el backend
responde 429. La escapatoria real: `pop.settings_e2e`
(`RATE_LIMITING_ENABLED = False`, ya la usa
`popyplan-mobile/.github/workflows/e2e-live.yml`) — el job `e2e` de
este repo la usa siempre (ver «CI» más abajo), así que en CI nunca
salta.

**Arranque**: `playwright.config.ts` levanta `next dev --port 3100`
(nunca 3000: ese puerto es el panel de demo del propietario en
`.worktrees/demo/`, que no se toca) con
`NEXT_PUBLIC_API_URL=http://localhost:8001`; `workers: 1` (las specs
comparten el mismo backend y el mismo límite de login, en paralelo se
pisarían). `PANEL_BASE_URL` (variable de entorno) apunta el runner a un
servidor ya arrancado en vez de que Playwright levante el suyo — útil
para iterar en local sin esperar a que compile cada vez.

### CI (`.github/workflows/ci.yml`, job `e2e`)

Cross-repo checkout de `emx-comunicaciones/popyplan` (privado) `@main`
con un PAT propio, mismo patrón que
`popyplan-mobile/.github/workflows/e2e-live.yml`: requiere el secret
**`BACK_REPO_TOKEN`** (Settings → Secrets and variables → Actions de
este repo; un token de acceso personal con lectura sobre ese repo). Sin
él, un primer paso (`check_token`) deja `skip=true` y el resto de pasos
(condicionados a `if: steps.check_token.outputs.skip != 'true'`) no
corren — el job termina en verde sin haber hecho nada, con un
`::warning::` explicando qué falta. **A diferencia del patrón del
móvil, aquí no hay `continue-on-error: true` a nivel de job**: si el
secreto existe y el backend arranca, un fallo real de los tests sí
tira abajo el workflow.

Backend: instala dependencias con `uv` (`scripts/export_deps.py`,
fijadas por `poetry.lock`) + shim de PyMySQL (por si algo importa
`MySQLdb`) + librerías del sistema de WeasyPrint (`apt-get`, igual que
`popyplan/.github/workflows/ci.yml`). **Desviación deliberada del
brief de esta tarea** (que pedía un servicio de MariaDB): el job usa
`DJANGO_SETTINGS_MODULE=pop.settings_e2e` en vez de levantar
MariaDB — ese módulo (ya existe en el backend, lo usa
`popyplan-mobile`) sustituye la base de datos por SQLite efímero (sin
servicio que levantar) y **desactiva el límite de login**
(`RATE_LIMITING_ENABLED = False`), imprescindible: con el límite activo
la suite entera de `e2e/` no puede correr seguida (ver arriba). Migra,
siembra (`load_places`, `seed_catalogs`, `seed_panel_demo`) y arranca
`runserver 0.0.0.0:8001` en segundo plano con una espera activa
(`GET /api/health/` hasta 200/401). Luego `npx playwright install
--with-deps chromium` y `npm run e2e` (`NEXT_PUBLIC_API_URL=http://
localhost:8001`); si falla, sube el log del backend y el reporte de
Playwright como artefactos.

## Comparativa entre ámbitos y memoria plurianual (tarea W2, Fase 6)

`docs/PANEL.md` §11 (contrato del backend, tarea B2): `GET
/api/panel/paraguas/{org_id}/compare/?since&until&group_by=comarca|
organization|place` y `GET /api/panel/plataforma/compare/?since&until&
group_by=comarca|province|organization` comparan el periodo pedido con
el inmediatamente anterior de igual longitud. A diferencia de métricas,
aquí `group_by` es **obligatorio** (400 con `{"group_by": "Desglose
obligatorio: …"}` si falta o no es uno de los tres valores de esa ruta).

- **`hooks/useCompare.ts`** (`useCompare(scope, orgId, period, groupBy)`,
  mismo patrón que `useMetrics`): traduce 400/403 a `CompareError` con
  `kind` (`periodo_invalido`/`sin_acceso`/`desconocido`).
  `lib/api/endpoints.ts::METRICS.COMPARE_PARAGUAS(orgId)`/
  `COMPARE_PLATAFORMA()`.
- **`components/metrics/ComparativaTable.tsx`** (`<ComparativaTable
  data={CompareResponse} />`): columnas Ámbito · Actividades (actual/
  anterior/Δ) · Personas (actual/anterior/Δ) · % asistencia (actual/
  anterior/Δ), con `<caption>` («Comparativa por `<desglose>`») y la
  leyenda del periodo anterior («frente a 1 ene – 31 mar 2026»,
  `lib/metrics/compare.ts::previousPeriodLabel`). `current`/`previous`
  reutilizan `formatCount`/`formatPct` tal cual (misma «<5» que el resto
  del panel); `delta` es propio de esta tarea
  (`lib/metrics/compare.ts::formatDeltaCount`/`formatDeltaPct`, signo
  `+`/`-`) — una diferencia suprimida (`delta.suppressed`, el «o» de los
  dos periodos) se pinta «—» con `aria-label="No disponible por umbral de
  agregación"`, **nunca** «<5» (no hay una cifra parcial que enseñar,
  solo indisponibilidad; `delta.events` sí es siempre un número real, los
  eventos nunca se suprimen).
- **Dashboards** (`{Paraguas,Plataforma}MetricsDashboard.tsx`): bloque
  «Comparativa» bajo las tarjetas/tabla existentes, con un `<select>`
  (label visible «Desglose de la comparativa») para elegir el desglose —
  por defecto `comarca` en paraguas, `province` en plataforma (la
  diputación compara comarcas, la plataforma compara provincias).

**Memoria plurianual (`group_by=year`, §11.4)**: añadido a
`hooks/useMetrics.ts::MetricsGroupBy` y a `EXPORT_GROUP_BY_CHOICES` del
backend — una fila por año (`SeriesRow.year`) en vez de por mes
(`.month`) en `series`, tanto en métricas como en exportación (que además
deja vacía «Por municipio» y renombra la sección a «Por año»).
`components/metrics/SeriesChart.tsx` detecta solo mirando las propias
filas (`row.year !== undefined` en todas) y cambia su `aria-label` a
«Serie anual…»; `ExportPanel.tsx` gana un `<select>` propio («Desglose
del informe») con la opción «Por año (memoria plurianual)», que
**sustituye** (nunca combina) al `groupBy` que le pase el dashboard que
lo envuelve — el backend nunca acepta los dos desgloses a la vez.

**`PeriodPreset += "plurianual"` (actualizado en la tarea W2b, Fase 6)**:
al escribir la tarea W2 original, `panel/viewsets.py::_periodo` (backend)
aplicaba el mismo tope duro de 366 días a `since`/`until` en todas las
rutas, así que el preset «últimos 3 años naturales completos + el
actual» que pedía el brief literal era matemáticamente imposible en una
sola petición (tocar 4 años naturales exige más de 1000 días) —
`presetPeriod('plurianual')` se quedaba en los 365 días de calendario
anteriores a hoy, rozando como mucho dos años naturales. La tarea B4
(en paralelo a W2b) subió `PERIODO_MAX_DIAS` a **1461** (~4 años)
precisamente para destrabar esto; W2b actualiza `MAX_DAYS` de
`lib/metrics/period.ts` a 1461 y reescribe el preset de forma literal:
desde el 1 de enero de hace 3 años hasta hoy (`presetPeriod('plurianual')`
= `{since: 1-ene-(año actual − 3), until: hoy}`), que siempre cae dentro
del nuevo tope (como mucho ~1461 días si hoy es 31 de diciembre). Ya no
hace falta la petición fusionada por años que quedó pendiente en la
versión anterior de esta nota.

## Programas de la entidad (tarea W3, Fase 6)

`docs/PANEL.md` §12 (contrato del backend, tarea B3): módulo programa —
campaña con fechas cerradas, presupuesto declarado (`budget_cents`,
céntimos) e informe final agregado, app `programs` separada de `panel`
pero reutilizando `panel.services.metrics`/`panel.services.exports`.
Invariante 1 extendida (docstring del propio backend): un programa nunca
lista personas, ni siquiera para el titular.

- **`lib/api/endpoints.ts::PROGRAMS`** — `LIST(orgId)`, `DETAIL(orgId,
  id)`, `ACTIVATE(orgId, id)`, `CLOSE(orgId, id)`, `REPORT(orgId, id)`.
  `lib/api/types.ts` añade `Program`/`ProgramStatus`/`ProgramCloseRequest`
  (del esquema generado) y `ProgramWriteFields` a mano:
  `PatchedProgramInputRequest` (generado) marca `description`/`funder`
  como obligatorios pese al `partial=True` real del backend
  (`ProgramInputSerializer(required=False, default='')`) — quirk de
  drf-spectacular con un campo `default` no de solo lectura, mismo patrón
  de mismatches ya documentado en ese fichero; `ProgramWriteFields` es el
  tipo manual con todo opcional en `PATCH` que sí refleja el comportamiento
  real.
- **Hooks** (`hooks/use{Programs,Program,ProgramMutations,ProgramReport}.ts`):
  `usePrograms`/`useProgram` (lectura, mismo patrón `ApiError`→`kind`
  tipado que el resto del panel); `useProgramMutations.ts` agrupa
  `useCreateProgram`/`useUpdateProgram`/`useActivateProgram`/
  `useCloseProgram` — sus 400/409 traducen el mensaje **literal** del
  backend cuando lo trae (`{"ends_on": [...]}` de `ProgramInputSerializer.
  validate`, `{"detail": "Un programa cerrado no se modifica."}` de
  `TransicionInvalida`) en vez de uno genérico, con un `detailOf` que
  cubre las dos formas de error de DRF (campo por campo y `detail` suelto).
  `useProgramReport.ts` reutiliza el patrón de `useExport.ts` (el informe
  no es JSON: `fetch` a mano con el token en memoria y descarga por
  `<a download>`) pero sin `since`/`until`/`group_by` — la ruta solo
  acepta `format`, el periodo lo decide el propio programa en el backend.
- **`lib/programs/{money,validation}.ts`**: `eurosToCents`/`formatEuros`
  convierten entre el euro con decimales del formulario y `budget_cents`
  (redondeando tras multiplicar por 100, para no arrastrar el error de
  coma flotante de JS); `formatEuros` fuerza `useGrouping: "always"` igual
  que `INTEGER_FORMATTER` de `lib/metrics/format.ts` — sin eso, la CLDR
  reciente de `es-ES` no agrupa millares por debajo de 5 cifras
  (`1234,56 €`, no `1.234,56 €`), inconsistente con el resto del panel.
  `validateProgramDates` valida `fin >= inicio` en el cliente con el
  mismo mensaje literal que el 400 del backend (§12.3).
- **`components/entidad/{ProgramasPanel,ProgramaForm,ProgramaDetalle}.tsx`**:
  `ProgramasPanel` (listado, «Nuevo programa» solo `canManage`) y
  `ProgramaForm` (alta/edición, mismo patrón `editing: Program | "new"`
  que `RecursosPanel.tsx::ResourceForm`) siguen los patrones ya
  establecidos. `ProgramaDetalle` compone cabecera (estado en `Badge`,
  presupuesto formateado, «Editar»/«Activar»/«Cerrar programa»/
  «Descargar informe CSV»/«PDF» según estado y permiso) más
  `ProgramaMetrics`, un componente hijo aparte que solo se monta una vez
  `program.data` está cargado — así `useMetrics("entidad", orgId, {since:
  starts_on, until: ends_on}, "month")` nunca se llama con un periodo
  provisional mientras el programa aún carga (los hooks de React no
  pueden ser condicionales dentro de un mismo componente). Con
  `group_by=month`, `by_place` siempre llega vacío
  (`panel/services/metrics.py::_by_place` solo rellena con
  `place`/`comarca`/`province`/`organization`): `MetricsTable` se sigue
  reutilizando tal cual (la sección solo se pinta si `by_place.length >
  0`, mismo patrón condicional que `RecursosPanel` por categoría) para
  quedar lista si el backend añadiera algún día un desglose combinado.
  «Cerrar programa» pide notas de cierre en el propio `ConfirmDialog`
  (`description` admite cualquier `ReactNode`, no solo texto).
- **Menú** (`lib/auth/entidadMenu.ts`): Programas es la única sección
  visible para los cinco roles de entidad (el backend solo pide
  `ver_panel` para leer, igual que Inicio) — a diferencia de Informes,
  que además exige `exportar_informes` y por eso queda fuera de
  `analista`/`referente`. El menú pasa de 13 a **14** secciones;
  `ANALISTA_VISIBLE`/`REFERENTE_VISIBLE` ganan `"programas"`, sin tocar
  `DINAMIZADOR_HIDDEN` (no la excluye, así que `dinamizador` la ve por no
  estar en esa lista). Gestionar (crear/editar/activar/cerrar) sigue
  acotado a `titular`/`moderador` (`gestionar_programas`, comprobado en
  el propio componente, `canManage`); descargar el informe usa
  `canExport` (`titular`/`moderador`/`analista`, calculado en el Server
  Component de la ficha igual que en Informes, `exportar_informes`).
- **Inicio de la entidad**: `useEntityHome.ts` añade `activePrograms`
  (reutiliza `usePrograms`, sin traducir un 403 a `null` como los
  contadores de guardia — Programas no tiene ese hueco de permiso, es
  `ver_panel` para todos); `EntityHomeDashboard.tsx` pinta una tarjeta
  «Programas en curso» con el recuento de `status === 'active'` (no hay
  endpoint de solo recuento) y un enlace a `/entidad/{slug}/programas`.

**Bug real encontrado por `e2e/programas.spec.ts` (tarea W5, no por
Vitest — los mocks de test nunca ejercitan la clave real de la query):
la ficha de un programa no se refrescaba sola tras «Activar»/«Cerrar
programa»/«Editar».** `useProgram(orgId, programId)` guarda su caché con
`programId` tal cual llega de la página — un **string** (parámetro de
ruta de Next.js) — pero `useActivateProgram`/`useCloseProgram`/
`useUpdateProgram` (`hooks/useProgramMutations.ts`) invalidan con el
`id` que devuelve la API tras la mutación (`data.id`/`editing.id`), un
**number** (`Program.id`). Para `invalidateQueries`, `1 !== "1"`: la
invalidación de `["panel-program", orgId, programId]` nunca coincidía
con la entrada cacheada, así que el botón parecía no hacer nada — la
mutación sí llegaba al backend (confirmado con la traza de Playwright:
`POST .../activate/` respondía 200), solo la UI se quedaba con el
estado viejo hasta recargar la página a mano. Arreglado normalizando a
`String(programId)` en la clave, tanto en `useProgram.ts` como en
`invalidatePrograms` (`useProgramMutations.ts`) — mismo patrón que
evitaría el mismo fallo en cualquier hook futuro que mezcle un id de
ruta (string) con un id de API (number) en la misma clave de caché.

## Contratos y facturación de plataforma (tarea W4, Fase 6)

`docs/PANEL.md` §13 (contrato del backend, tarea B4): app `billing`,
exclusiva del área de plataforma — ninguna entidad la ve, ni siquiera su
titular. Tres modelos: `PricingTier` (tramo de precio anual por rango de
población), `Contract` (`draft -> active -> ended`, siempre hacia
adelante) e `Invoice` (`status` calculado: `paid`/`pending`/`overdue`).
Invariante 7 extendida (docstring del propio backend, `billing/models.py`):
un contrato `ended` no condiciona ninguna función de la entidad, la
plataforma solo lo ve en su lista para gestionar el cobro.

- **`lib/api/endpoints.ts::BILLING`** — `TIERS`, `TIER`, `CONTRACTS`,
  `CONTRACT`, `CONTRACT_ACTIVATE`, `CONTRACT_END`, `CONTRACT_INVOICES`,
  `INVOICE_PAY`, `SUMMARY`. `lib/api/types.ts` toma `PricingTier`/
  `Contract`/`ContractStatus`/`Invoice`/`BillingSummary` del esquema
  generado sin discrepancias; dos tipos manuales:
  `PricingTierUpdateRequest` (el generado `PatchedPricingTierInputRequest`
  marca `min_population`/`is_active` como obligatorios pese al
  `partial=True` real — mismo quirk de drf-spectacular ya documentado en
  `ProgramWriteFields` para Programas, un campo con `default` no de solo
  lectura sale como requerido) e `InvoiceStatus` (`Invoice.status` es una
  propiedad calculada que el esquema tipa como `string` a secas).
- **`hooks/useBilling.ts`**: un solo fichero para lectura y escritura
  (`useBillingSummary`/`useTiers`/`useContracts(filters)`/
  `useInvoices(contractId)`; `useCreateTier`/`useUpdateTier`/
  `useCreateContract`/`useUpdateContract`/`useActivateContract`/
  `useEndContract`/`useCreateInvoice`/`usePayInvoice`), mismo patrón
  `detailOf`/`BillingError{kind}` que `useProgramMutations.ts`.
- **`components/plataforma/ContratosPanel.tsx`**: tres pestañas con el
  mismo selector de botones que `EntidadDetail.tsx` (sin ARIA tabs) —
  **Contratos** (filtros entidad/estado, alta/edición/activar/finalizar),
  **Tramos** (`TierForm`, componente local — no un fichero aparte, el
  formulario es pequeño) y **Facturas** (selector de contrato, alta y
  «Marcar pagada» con fecha embebida en un `ConfirmDialog`, mismo patrón
  que «Cerrar programa» pide notas de cierre). `canManage = role ===
  "superadmin"`: los botones de escritura se **ocultan** para `support`,
  nunca se deshabilitan. `components/plataforma/{ContratoForm,
  FacturaForm}.tsx` son los formularios de alta/edición de contrato y
  alta de factura; `eurosToCents`/`formatEuros` se reutilizan tal cual de
  `lib/programs/money.ts` (mismo formateador es-ES, sin duplicarlo en un
  `lib/billing/money.ts` propio).
- **Menú y visibilidad** (`lib/auth/plataformaMenu.ts`): «Contratos»
  visible para `superadmin` y `support` (los dos roles con lectura real
  de `billing`, `HasPlatformRole('superadmin', 'support')`); ni
  `moderator` ni `verifier` la ven. El menú pasa de 8 a 9 secciones.
- **Inicio de plataforma** (`PlataformaHomeDashboard.tsx`): tres tarjetas
  del `summary` («Contratos vigentes», «Valor anual contratado» con
  `Intl.NumberFormat("es-ES", {style:"currency", currency:"EUR"})`,
  «Facturas vencidas»), visibles solo si el menú del rol trae
  «contratos».
- **Ficha de entidad de plataforma** (`EntidadDetail.tsx`): séptima
  pestaña «Contrato» — tramo, vigencia y última factura (por
  `issued_on`) de la entidad, de solo lectura; prioriza el contrato
  `active` si hay varios (histórico); 403 (`verifier`) se traduce a «Sin
  acceso», mismo patrón que Equipo/Métricas.
- **Límite conocido**: el selector de entidad de `ContratoForm` usa
  `useOrganizations()` sin filtro, solo la primera página — suficiente
  para el volumen de entidades de esta fase; paginar el propio selector
  queda para quien amplíe esta pantalla.

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

**Hardening de sesión (auditoría de bugs, 2026-09):**

- **El middleware tiene single-flight propio** (`inFlightByRefresh`, mapa
  por valor de refresh): peticiones concurrentes con la misma cookie
  comparten una sola llamada a `token/refresh/` — sin él, el perdedor de la
  carrera recibía 401 y respondía `Set-Cookie` de borrado, destruyendo la
  sesión de quien acababa de entrar (misma clase que el bug de demo que
  `lib/api/client.ts` ya tenía resuelto solo en el cliente). Además el
  borrado de cookie en 401 **solo se aplica a navegaciones de documento**
  (`sec-fetch-dest: document`, o ausente de la cabecera); en prefetch/RSC
  se deja pasar sin tocarla (el navegador no aplica `Set-Cookie` de
  subpeticiones). Error de red del backend durante una navegación →
  **503** (antes dejaba pasar sin cabecera y los layouts redirigían a
  `/login` con la sesión válida).
- **Route handler `/api/session/refresh` resiliente**: error de red → 503
  sin borrar la cookie (antes: 500 → «Tu sesión ha caducada» y logout en
  cada despliegue del backend); si tras rotar el refresh falla `/me/` o
  `platform-roles/me/`, devuelve 503 **con la cookie ya fijada al refresh
  nuevo** — la rotación se aplicó en el backend y tirar R2 destruía la
  sesión sin culpa del usuario. En el cliente, un 5xx del handler de
  refresh lanza `ApiError` reintentable (TanStack reintenta) en vez de
  logout; solo el 401 cierra sesión.
- **`getServerSession` tolerante**: si `/me/` va bien pero
  `platform-roles/me/` falla con 5xx/red, la sesión se resuelve con
  `platformRole = { role: null }` (un 502 puntual ya no manda a `/login`);
  401/403 del endpoint de roles siguen anulando la sesión.
- **`fetchWithAuth`** (`lib/api/client.ts`): como `apiFetch` pero devuelve
  el `Response` sin parsear — lo usan las descargas de ficheros
  (`hooks/useExport.ts`, `hooks/useProgramReport.ts`), que antes hacían
  `fetch` a mano y ante un 401 mostraban «No se pudo generar el informe.»
  pudiendo refrescar; ahora refrescan y reintentan, y si la sesión murió
  avisan como el resto (`ApiError(401)` → `SessionExpiredHandler`).
  Nuevo kind de error en ambos hooks: `sesion_caducada`.
- **Logout con timeout** (`hooks/useAuth.ts`): `AbortController` + 5 s;
  un backend colgado ya no deja «Cerrando sesión…» indefinidamente.

## Comandos

- `npm run dev` / `npm run build` / `npm run start`
- `npm run typecheck` (`tsc --noEmit`)
- `npm run lint` (ESLint + `eslint-plugin-jsx-a11y` en modo `strict`)
- `npm run test` / `npm run test:coverage` (Vitest + Testing Library)
- `npm run gen:types` — regenera `lib/api/types.generated.ts` desde
  `../popyplan/docs/schema.yaml` (`openapi-typescript`); se commitea.
- `npm run e2e` (Playwright contra el backend real, `e2e/*.spec.ts` —
  ver «Cierre del panel» más arriba para credenciales, límite de login
  y el job `e2e` de CI)

Verificación antes de cerrar cualquier tarea:
`npm run typecheck && npm run lint && npm run test:coverage && npm run build`
(`npm run e2e` también, cuando haya un backend local sembrado a mano —
en CI lo gate el job `e2e`).

## Cobertura

- Vitest mide líneas sobre `lib/**`, `hooks/**` y `app/**/*.ts` (route
  handlers y helpers; nunca `.tsx` de páginas/layouts/componentes, que se
  prueban por comportamiento, no por cobertura —
  `components/metrics/*.tsx` y `components/entidad/*.tsx` tampoco
  cuentan). Umbral con ratchet en `vitest.config.ts`
  (`coverage.thresholds.lines`): **100 % al cerrar W1, W2 y W3** (umbral
  fijado a 99.7, real menos 0.3); solo puede subir. Objetivo final del
  plan de cobertura: ≥98 % (ya superado aquí). Real al cerrar W4/W5:
  **99,89 %** (1964/1966 líneas, sin cambios entre ambas tareas — W5 solo
  añade specs de Playwright, que no cuentan para esta métrica); real
  menos 0,3 (99,59) sigue por debajo del umbral ya fijado (99,7), así que
  el ratchet no sube en esta tarea (mismo caso que W4). Tras la auditoría
  de bugs de 2026-09: **99,84 %** de líneas (el umbral fijado sigue en
  99,7; real menos 0,3 = 99,54).
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
  `lang="es"`, foco visible, etiquetas de formulario). Desde la tarea
  W6, `axe-core` (`vitest-axe`) corre en un test dedicado de las páginas
  representativas de cada área — ver «Cierre del panel» arriba para la
  lista exacta y la excepción documentada.

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
