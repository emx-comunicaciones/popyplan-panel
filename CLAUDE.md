# CLAUDE.md — Popyplan Panel

> `AGENTS.md` es una copia de este fichero: si actualizas uno, actualiza el otro.

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
  `superadmin`, `verifier`, `moderator`, `support`). Menú de 9 secciones
  (Inicio, Entidades, Reportes, Ayuda, Verificaciones, Roles, Auditoría,
  Métricas, Contratos), con visibilidad por rol
  (`lib/auth/plataformaMenu.ts`) —
  ver «Área de plataforma» más abajo.

`lib/auth/area.ts::resolveArea(me, platformRole)` decide el área: el rol
de plataforma manda sobre cualquier rol de entidad; con varias entidades
elegibles, `/elegir-entidad` deja escoger.

**Regla de paraguas (al día, 2026-09):** `GET /api/users/users/me/`
(`OrgMembershipRefSerializer`, `users/profile_serializers.py` en el
backend) **sí** dice el tipo de organización de cada membresía, en el
campo `organization_type` (`source='organization.org_type'`, desde la
ronda de cierre de Fase 5; `OrgMembershipRef.organization_type: string`
en `docs/schema.yaml`, y el backend seedeado devuelve
`"organization_type": "administracion"` para `panel-analista-gfa@test.com`).
`lib/auth/area.ts::isParaguas` lo lee de ahí, así que una `analista` o
`titular` de una diputación aterriza en `/paraguas/{slug}` sin pasar por
`/elegir-entidad` (con varias membresías paraguas se resuelve a la
primera del array; decisión fijada por `lib/auth/area.test.ts`).

`isParaguas` acepta además un `org_type === 'administracion'` heredado,
el nombre que la nota original de la tarea W1 daba por bueno y que el
backend nunca ha usado: `OrgMembershipForArea` (`lib/api/types.ts`) lo
declara como campo opcional y varios fixtures de test lo usan, así que
la rama se mantiene como respaldo. Las dos notas que este fichero
arrastraba (W1: «el backend no expone el tipo»; W5: «el campo llegó con
otro nombre y no se corrige») quedan **obsoletas**: el fix de una línea
que describían está aplicado desde la primera ronda de la auditoría
estática. `e2e/analista.spec.ts` y `e2e/comparativa.spec.ts` siguen
navegando a mano a `/paraguas/...`, ahora a propósito (así el flujo bajo
prueba no depende de la resolución de área).

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
- **Regla de supresión de `members_count`**: un fix de backend suprime el
  recuento de personas (`null` + `suppressed: true`) para quien no tiene
  `ver_lista_nominal` en la entidad. Al escribir esta tarea
  `docs/schema.yaml` todavía documentaba `FamiliesSummary.members_count`/
  `FamilyCommunityRow.members_count` como `number` a secas, así que
  `lib/api/types.ts` los ampliaba a mano a `number | null` con un
  `suppressed?` opcional (mismo patrón que `PeopleMetrics`). **Esa
  ampliación manual ya no existe** (retirada en la Tarea 1 del plan de
  «Red de apoyo», Fase 7: el esquema regenerado desde la rama de backend
  correspondiente ya tipa los dos campos como `number | null` con
  `suppressed: boolean` **obligatorio**, así que `FamiliesSummaryCommunityRow`/
  `FamiliesSummary` son hoy alias directos del esquema generado, sin
  ensanche a mano). Se pinta con `formatCount` (`lib/metrics/format.ts`,
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

## Red de apoyo (Fase 7)

`~/Code/popyplan/docs/PANEL.md` §14.5 (lo que ve el referente y los
contadores de Familias) y §14.6 (datos de demo), rama de backend
`feature/red-de-apoyo-backend`. El panel consume solo esa cara del
contrato — invitar/aceptar/pausar un vínculo, «pedir ayuda» y «me
encargo» son pantallas del móvil (spec `2026-09-18-red-de-apoyo-design.md`
§7); aquí no hay ninguna acción de escritura sobre la red, solo lectura
condicionada al rol y tres contadores agregados. **Nunca** una lista de
quién acompaña a quién fuera de la ficha que ve el referente.

- **Tipos y hook** (`lib/api/types.ts`, `hooks/usePersonSupport.ts`):
  `PersonSupportRow` alias `components["schemas"]["ReferentNetworkRow"]`
  (el esquema nombra la fila distinto de como la nombraba el plan,
  anotado con un docstring) — `{supporter: {id, public_name},
  relationship, notify_on_help}`. `usePersonSupport(orgId, userId,
  enabled)` pide `GET /api/panel/entidad/{org_id}/people/{user_id}/support/`
  (`PANEL.PERSON_SUPPORT`) y traduce 403/404 a `kind: 'sin_acceso'`
  (titular/moderador que no son el referente asignado reciben 404 con el
  mismo `detail` que la ficha, para no revelar que la persona tiene red;
  `analista` recibe 403 antes de llegar a `ver_ficha`); cualquier otro
  error queda `'desconocido'` con el `detail` literal del backend
  (`lib/api/drfError.ts::detailOf`). `lib/support/relationshipLabel.ts`
  traduce las ocho relaciones del contrato (`parent`→«Madre o padre»,
  `friend`→«Amistad», …), con reserva al valor crudo si el backend añade
  una relación nueva, mismo patrón que `lib/reports/labels.ts`.
- **Ficha de persona, decisión 1-2 del plan** (`components/entidad/
  PersonSheet.tsx::SupportNetworkSection`): la sección solo se monta
  (hook llamado con `enabled: isReferent`) si `membership.role ===
  'referente'` (calculado en `app/entidad/[slug]/personas/[userId]/
  page.tsx`, junto a `canAssignReferent`) — así titular/moderador ni
  siquiera disparan la petición que el backend rechazaría a propósito.
  Con `isReferent` y `kind: 'sin_acceso'` (404/403 real, poco probable
  pero posible si el rol cambia entre el render del Server Component y
  la petición del cliente), la sección **no se pinta nada en absoluto**
  — ni cabecera ni mensaje: mostrar que existe la sección ya sería un
  dato. Con datos, cada fila es «`{public_name} · {relationshipLabel} ·
  Recibe avisos|Sin avisos`» (invariante 9: nunca contacto, fechas ni
  quién invitó a quién) y una línea fija: «Solo tú, como referente, ves
  esta red. Popyplan no guarda teléfonos: contacta con la persona por el
  chat de la app.». Un error real (`'desconocido'`) sí pinta un
  `ErrorState` **dentro** de la sección, sin romper el resto de la
  ficha.
- **Familias, decisión 3-4 del plan** (`components/entidad/
  FamiliasPanel.tsx`): tres `StatCard` más en el resumen («Personas con
  red de apoyo», «Apoyos activos», «Apoyos que reciben avisos»,
  `people_with_support_network`/`active_supporters`/
  `supporters_notified_on_help`, cada una ya `SuppressibleCount` en el
  esquema generado) pintadas con `formatCount(value, suppressed)` como
  el resto del panel — ninguna lógica de supresión nueva. Un aviso
  `role="status"` sobre `missing_families_space_supporters` (entero sin
  umbral: cuenta apoyos **distintos** a la espera de que la entidad cree
  su comunidad de familias, nunca personas, así que no lleva `<5`):
  sin comunidad de familias, «`<N>` persona(s) de la red de apoyo
  espera(n) a que crees la comunidad de familias.» (singular con 1)
  justo encima del botón «Nueva comunidad de familias» ya existente
  (`canManage`, sin diálogo nuevo); con comunidad ya creada y el
  contador todavía > 0 (carrera de la señal diferida, §14.5), «El alta
  en la comunidad de familias se completará automáticamente.». Con el
  contador a 0, sin aviso. Ningún nombre de apoyo se pinta en este
  panel.
- **Recursos, decisión 6**: `accompany` (`CATEGORY_ORDER`/
  `CATEGORY_LABELS`, `components/entidad/RecursosPanel.tsx`, líneas
  ~40-56) entra tras `families` como «Cómo acompañar», junto a las seis
  categorías de la tarea W4b — el `<select>` del formulario ya deriva
  sus opciones de esas dos constantes, sin cambio adicional.
- **Comunicaciones, decisión 5** (`lib/communications/templates.ts`,
  `components/entidad/ComunicacionesPanel.tsx::ComposeForm`): botón
  «Usar plantilla: Bienvenida a la red de apoyo», visible solo con
  `hasFamilies` (dentro de `ComposeForm`, que el padre ya solo monta con
  `canCompose`, así que no hace falta una comprobación extra). Rellena
  título/cuerpo con `SUPPORT_WELCOME_TEMPLATE` (texto fijo, única fuente
  esa constante) y selecciona audiencia «Familias»; no envía nada por sí
  solo. Si el título o el cuerpo ya tienen texto, `applyTemplate`
  devuelve `overwritten: true` y se pide confirmación con
  `ConfirmDialog` («Se reemplazará el texto actual del título y del
  cuerpo.») antes de sobrescribir; con el formulario vacío se aplica
  directamente.
- **Encuestas**: sin cambios — la spec de esta fase no pedía ninguno ahí.
- **Cuentas de demo** (`docs/PANEL.md` §14.6, contraseña
  `panel-pass-1234` para todas): «Persona 01» de Asociación Bidasoa
  tiene dos apoyos, `panel-demo-apoyo-01@test.com` («Apoyo 01», relación
  `parent`, recibe avisos) y `panel-demo-apoyo-02@test.com` («Apoyo 02»,
  relación `friend`, sin avisos); «Persona 02» tiene uno,
  `panel-demo-apoyo-03@test.com` (`partner`, recibe avisos). Las dos
  personas tienen `Reference` hacia
  `panel-referente-asociacion-bidasoa@test.com`, que por eso ve «Red de
  apoyo» en sus fichas; `panel-titular-asociacion-bidasoa@test.com` ve
  las mismas fichas sin esa sección (no es el referente). **Elkartea
  Txikia** (`elkartea-txikia`,
  `panel-titular-elkartea-txikia@test.com`) es una sexta entidad
  sembrada a propósito **sin** comunidad de familias, con
  `panel-demo-apoyo-04@test.com` a la espera de que se cree
  (`missing_families_space_supporters === 1`) — es el único caso real
  del aviso «crea tu comunidad de familias» en la demo; no se le quita
  el espacio de familias a ninguna de las dos asociaciones grandes
  porque son las que usa el resto de tests y del e2e del panel.
- **`e2e/red-de-apoyo.spec.ts`** (`e2e/helpers.ts` gana
  `REFERENTE_BIDASOA_EMAIL`/`TITULAR_TXIKIA_EMAIL`): referente Bidasoa
  ve «Red de apoyo» en la ficha de «Persona 01» con el `public_name`
  real de `panel-demo-apoyo-01@test.com` (leído por API,
  `GET /api/users/users/me/`, nunca «Miren» a mano — ese nombre es solo
  el ejemplo ilustrativo de `docs/PANEL.md` §14.5, la demo real usa
  «Apoyo `NN`»); titular Bidasoa no ve esa sección en la misma ficha;
  titular de Elkartea Txikia ve en Familias el aviso de «1 persona» y el
  botón «Nueva comunidad de familias». Solo 4 logins en todo el spec
  (límite de 5/min/IP en local, `pop.settings_e2e` lo desactiva en CI):
  un login de API (`panel-demo-apoyo-01`, para leer su `public_name`) y
  tres logins de UI (referente, titular Bidasoa, titular Txikia) — sin
  resolver ningún id por API, la navegación es toda por clic (Personas →
  «Persona 01»), igual que `e2e/titular.spec.ts`.
- **La ficha de persona sale de la excepción de `axe`**: ver «Cierre del
  panel» más abajo — pasa a tener su propio test de accesibilidad ahora
  que gana una sección condicional por rol (referente con datos), no
  solo la ausencia de un campo.

## Área de plataforma: Inicio, Entidades, Reportes, Ayuda, Verificaciones, Roles, Auditoría (tarea W5)

`docs/SEGURIDAD_Y_MODERACION.md` (§1 roles de plataforma, §4 reportes,
§5 ayuda, §7 verificación, §8 organizaciones) y `docs/PANEL.md` (§1
métricas de plataforma, dashboard-stats). Páginas bajo `app/plataforma/`,
Server Component con sesión + `plataformaMenuFor(role)` (redirect si no
está en el menú de ese rol → `EmptyState` «Sin acceso»; el layout ya
filtra el propio menú lateral con la misma función).

**Matriz de visibilidad** (`lib/auth/plataformaMenu.ts::plataformaMenuFor`,
sacada del permiso real de cada endpoint, no inventada): `superadmin` ve
todas las secciones (las 8 de W5, más Contratos desde W4 de Fase 6 —
`support` también la ve, ver «Contratos y facturación» más abajo);
`verifier` solo Inicio/Entidades/Verificaciones
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
  (`ConfiguracionPanel.tsx`/`EntidadDetail.tsx`), que sí reciben
  `OrgMembership.public_name`. **La tabla de Referencias no**: `Reference`
  trae el `public_name` de la persona referenciada, pero del referente
  solo `referent: number`, así que `ConfiguracionPanel::ReferentName`
  resuelve el nombre contra `useOrgMembers` y distingue tres estados
  («Referente…» mientras carga, «Referente no disponible» con la consulta
  en error, «Referente sin nombre» si el equipo está cargado y esa cuenta
  no está). Y solo lo intenta con rol `titular`: el `GET` de equipo es
  solo-titular (`entities/permissions.py`, `'equipo': {'titular'}`), así
  que con `moderador` se pinta «sin nombre» sin pedir nada.
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
4. **La descarga de informes no llevaba el nombre de fichero real**
   (`e2e/titular.spec.ts`, flujo de Informes) — **resuelto, en el repo
   backend**. `pop/settings.py` no declaraba `CORS_EXPOSE_HEADERS`, así
   que `Content-Disposition` — donde viaja
   `popyplan-<slug>-<since>-<until>.csv` (`docs/PANEL.md` §2.2) — no es
   una cabecera "segura" por defecto y el navegador se la ocultaba a
   `fetch()` en una petición cross-origin (el panel en `:3000`/`:3100`
   contra el backend en `:8001`): `useExport.ts::filenameFrom` caía
   siempre al nombre por defecto (`informe.csv`), en el panel real
   igual que en el test. Desde entonces el backend declara
   `CORS_EXPOSE_HEADERS = ['Content-Disposition']` (y `pop.settings_e2e`
   lo hereda con su `from .settings import *`, así que el job `e2e` de
   CI también lo tiene). `e2e/titular.spec.ts` y `e2e/programas.spec.ts`
   comprueban ya el nombre completo con
   `e2e/helpers.ts::expectExportFilename`, que solo acepta el nombre de
   respaldo si la respuesta no trae `Access-Control-Expose-Headers` con
   esa cabecera — así un backend anterior al cambio no deja el test
   verde por casualidad.

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
  del propio `@/test-utils/render` para tener `container`. La lista
  exacta y siempre comprobable es
  `grep -rln "toHaveNoViolations" app components`; tras la Tarea 5 del
  plan de «Red de apoyo» (Fase 7, la ficha de persona gana su propio
  test) son **23 páginas y 4 componentes**:
  `app/(auth)/login`, `app/accesibilidad` (declaración pública, tarea
  W1), `entidad/[slug]` (Inicio), `entidad/[slug]/personas`
  (tabla + diálogo «Añadir persona» abierto, valida el foco atrapado),
  `entidad/[slug]/personas/[userId]` (ficha, con la sección «Red de
  apoyo» del referente y datos), `entidad/[slug]/informes`,
  `entidad/[slug]/asistencia/[eventId]`
  (caja de check-in), `entidad/[slug]/encuestas/[surveyId]` (gráfico
  `recharts`), `entidad/[slug]/familias` (resumen + lista de comunidades,
  ronda final de Fase 5), `entidad/[slug]/comunidades`,
  `entidad/[slug]/configuracion`, `entidad/[slug]/reportes` (cola),
  `entidad/[slug]/programas` y `entidad/[slug]/programas/[programId]`,
  `paraguas/[slug]` (Inicio), `plataforma` (Inicio),
  `plataforma/entidades` (tabla + diálogo «Nueva entidad» abierto),
  `plataforma/reportes` (cola) y `plataforma/reportes/[reportId]`,
  `plataforma/metricas`, `plataforma/contratos`, más las dos rutas de
  error (`app/error`, `app/not-found`); y, a nivel de componente,
  `components/entidad/GuardiaPanel`,
  `components/plataforma/AyudaPendienteList`,
  `components/metrics/ComparativaTable` y
  `components/metrics/ExportPanel` — estos cuatro cubren por dentro lo
  que sus páginas (`guardia`, `plataforma/ayuda`, la comparativa de los
  dos dashboards y los dos `informes`) no comprueban por fuera.
  **Excepción documentada**: siguen sin test propio de `axe`
  `elegir-entidad`, `entidad/[slug]/{actividades,asistencia,
  comunicaciones,encuestas,recursos,guardia}`,
  `entidad/[slug]/reportes/[reportId]`,
  `paraguas/[slug]/informes` y
  `plataforma/{auditoria,ayuda,verificaciones,roles,entidades/[id]}` — la
  cobertura es representativa de las tres áreas y de todos los patrones
  compartidos (tablas, diálogos con foco atrapado, gráficos, formularios,
  pestañas), pero no exhaustiva; ampliarla es trabajo mecánico para quien
  retome accesibilidad.
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

**Hueco de contrato de W5, ya cerrado** (pregunta 3 de
`docs/preguntas-diseno.md`): el login de la analista de la diputación
(`panel-analista-gfa@test.com`) aterrizaba en
`/entidad/gipuzkoako-foru-aldundia` porque `isParaguas` miraba un campo
(`org_type`) que el backend nunca ha servido; con `organization_type`
(ver «Regla de paraguas» al principio de este fichero) resuelve ya a
`/paraguas/...`. `e2e/analista.spec.ts` y `e2e/comparativa.spec.ts`
siguen navegando a la vista de paraguas a propósito
(`page.goto('/paraguas/gipuzkoako-foru-aldundia')`): el gate de la página
solo mira membresía + rol, así que el flujo bajo prueba queda fijado sin
depender de la resolución de área.

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
(`matcher`: `/`, `/entidad/**`, `/paraguas/**`, `/plataforma/**`,
`/elegir-entidad` — la raíz entró con el hallazgo A2 de la segunda
ronda) hace el refresco una vez por navegación, rota la cookie, y pasa
el access token a la petición como cabecera interna
(`ACCESS_TOKEN_HEADER = 'x-pp-access-token'`, nunca llega al navegador)
que `getServerSession` lee con `headers()` de `next/headers`. Sin
cookie, o si el backend rechaza el refresh, una navegación de documento
va a `/login?returnTo=<destino>` (y un prefetch/RSC pasa sin cabecera,
con lo que `getServerSession` devuelve `null` y el layout redirige);
**el middleware no borra nunca la cookie**, eso lo hace el route handler
de refresco o el logout (F3, ver «Hardening de sesión» más abajo).

`lib/api/serverFetch.ts` (servidor) no reintenta nunca — quien llama
decide (`redirect('/login')`).

**Hardening de sesión (auditoría de bugs, 2026-09):**

- **El middleware tiene single-flight propio** (`inFlightByRefresh`, mapa
  por valor de refresh): peticiones concurrentes con la misma cookie
  comparten una sola llamada a `token/refresh/` — sin él, el perdedor de la
  carrera recibía 401 y respondía `Set-Cookie` de borrado, destruyendo la
  sesión de quien acababa de entrar (misma clase que el bug de demo que
  `lib/api/client.ts` ya tenía resuelto solo en el cliente). **El
  middleware ya no borra la cookie en ningún camino** (F3, revisión final
  de la rama): un 401 del backend no distingue «caducado» de «otro
  proceso lo rotó hace un instante», y el middleware corre en Edge sin
  acceso al `rotationCache` del route handler (que vive en Node), así que
  el borrado tiraba también el refresh nuevo que el navegador ya tenía.
  Ahora una navegación de documento con el refresh rechazado solo redirige
  a `/login?returnTo=<destino>`; un prefetch/RSC pasa sin sesión, igual
  que antes (el navegador no aplica `Set-Cookie` de subpeticiones). Error
  de red del backend durante una navegación → **503** (antes dejaba pasar
  sin cabecera y los layouts redirigían a `/login` con la sesión válida).
- **Route handler `/api/session/refresh` resiliente**: error de red → 503
  sin borrar la cookie (antes: 500 → «Tu sesión ha caducada» y logout en
  cada despliegue del backend); si tras rotar el refresh falla `/me/` o
  `platform-roles/me/`, devuelve 503 **con la cookie ya fijada al refresh
  nuevo** — la rotación se aplicó en el backend y tirar R2 destruía la
  sesión sin culpa del usuario. En el cliente, un 5xx del handler de
  refresh lanza `ApiError` en vez de cerrar sesión, y ese error se
  propaga como fallo de la consulta (la vista pinta su `ErrorState`):
  **no hay reintento automático**, porque `app/providers.tsx` fija
  `retry: false` para todas las queries — la nota anterior («TanStack
  reintenta») era falsa. Solo el 401 cierra sesión.
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

## Auditoría estática 2026-09-18 (segunda ronda)

Segunda revisión completa de lectura (rama `bugfix/repo-audit`, base
`47664b4`), esta vez con el árbol del backend delante para comprobar cada
contrato en su código, no solo en `docs/schema.yaml`: **3 hallazgos
altos, 16 medios y 40 bajos**. Todos corregidos con test primero (rojo →
verde) salvo `B6` (crecimiento de `OutstandingToken`/`BlacklistedToken`
por rotación: es del repo backend, `flushexpiredtokens`). La suite pasa
de 1014 a **1362 tests**; cobertura de líneas **99,86 %**. La revisión
completa de la rama sobre ese trabajo añadió cinco hallazgos más (F1-F5)
y siete menores — ver «Revisión final de la rama» al final de esta
sección: **1375 tests**, líneas **99,86 %**.

### Sesión, middleware y rutas de auth

- **`/` entra en `middleware.ts::config.matcher`** (A2, el más grave de
  los tres): `getServerSession` solo lee la cabecera interna que pone el
  middleware, así que en `app/page.tsx` la sesión era siempre `null` y
  **todos** los `redirect("/")` del panel (slug ajeno, rol de plataforma
  revocado, `elegir-entidad`) aterrizaban en `/login` con la cookie viva,
  como si se hubiera cerrado sesión; la pantalla «No tienes acceso a
  ningún área del panel» era inalcanzable. Los tests no lo veían porque
  mockean `getServerSession`.
- **`lib/auth/clientIp.ts::forwardedForHeaders`** (A1) reenvía la IP real
  (`x-forwarded-for` → primer valor, o `x-real-ip`) en las **cuatro**
  llamadas de auth al backend: login y logout (`app/api/session/route.ts`),
  refresco del route handler y refresco del middleware. El porqué está en
  su docstring: `users/rate_limiting.py::_get_rate_limit_key` agrupa por
  `ip:<REMOTE_ADDR>:<segundo segmento del path>`, así que login (5/min) y
  `token/refresh/` (100/min) comparten la clave `ip:<ip>:auth` y una sola
  lista de marcas de tiempo. Sin reenviar la IP, en producción toda
  petición sale con la del servidor Next: cinco navegaciones de cualquier
  persona dejaban el login en 429 para todo el mundo (y explicaban los
  429 de la suite e2e). **Frontera de confianza (F4, trade-off asumido y
  documentado, no arreglado)**: el panel reenvía el primer valor de la
  cabecera entrante *tal cual*, sin poder saber si lo puso el proxy o
  quien llama. El proxy delante de Next tiene que **fijar**
  `X-Forwarded-For` (`proxy_set_header X-Forwarded-For $remote_addr`),
  **nunca anexar** (`$proxy_add_x_forwarded_for`): si anexa, el primer
  elemento es el del cliente y basta rotarlo en cada intento para
  saltarse el límite de login. Descartar la cabecera entrante no es
  alternativa (vuelve el 429 global de A1). El arreglo duradero es del
  repo backend: clave de límite por endpoint (o por cuenta), no solo por
  IP. Anotado en el docstring del módulo y en `.env.example` («Notas de
  despliegue»).
- **Un solo refresco por cookie, también en el route handler** (M1):
  `lib/auth/singleFlight.ts::singleFlight(map, key, fn)` extrae la
  mecánica que ya tenía el middleware y ahora la usan los dos.
  `POST /api/session/refresh` comparte **toda** la operación (rotación +
  `/me/` + `platform-roles/me/`) entre peticiones concurrentes con la
  misma cookie, no solo la rotación. Además `lib/auth/rotationCache.ts`
  recuerda 3 s (`ROTATION_REPLAY_TTL_MS`) el resultado de una rotación
  con éxito, indexado por el refresh **viejo**: una petición que salió
  del navegador antes de aplicarse el `Set-Cookie` anterior recibe ese
  mismo resultado en vez de un 401 que borra la cookie. Purga perezosa al
  guardar y al consultar (si no, retendría access tokens y perfiles en un
  proceso de larga vida) y se vacía **entera** en el logout: la entrada
  peligrosa está indexada por el refresh anterior, no por el de la
  cookie que cierra sesión, así que borrar solo una clave no bastaba.
  **Alcance real de M1 (F3, revisión final de la rama)**: los dos
  single-flight y la caché de replay cierran la carrera **dentro de cada
  proceso**, no entre procesos — `middleware.ts` corre en el runtime Edge
  y `app/api/session/refresh/route.ts` en Node, con mapas y caché
  propios, y en multi-instancia tampoco se comparten. No se ha inventado
  una caché compartida (haría falta un almacén externo, trabajo aparte);
  la mitigación es que **solo el route handler borra la cookie**, porque
  es el único que consulta la caché de replay antes de dar el refresh por
  caducado (más el logout, que la borra a propósito). El middleware, ante
  un 401, se limita a mandar al login con el destino guardado: la cookie
  de más que se queda en el navegador no da bucle —`/login` está fuera
  del `matcher`— y la restauración de arranque de `app/providers.tsx`
  llama a ese route handler, que la borra con su 401 si de verdad estaba
  caducada, o **revive la sesión** si lo que había era la carrera.
- **`lib/auth/tokenRefresh.ts::parseRefreshedTokens`** (B3): un 200 del
  backend sin `access`/`refresh` string (proxy, despliegue a medias,
  página de error con estado 200) pasaba por un `as` y la cookie acababa
  valiendo la cadena `"undefined"`. Ahora se valida en los dos sitios que
  refrescan; el middleware distingue `rechazado` (no-2xx → borrar cookie)
  de `ilegible` (200 raro → **503**, la sesión puede estar sana). El
  login hace lo propio: cuerpo inesperado → 502 sin cookie.
- **`lib/auth/returnTo.ts::safeReturnTo`** (B1): sin cookie, o con el
  refresh rechazado, una **navegación de documento** va a
  `/login?returnTo=<pathname+search>`. La allowlist es por primer
  segmento (`entidad`/`paraguas`/`plataforma`/`elegir-entidad`) y la
  función devuelve `null`, no `/`, para que quien llame decida — en
  `LoginForm.tsx` un valor descartado cae al área que resuelve
  `resolveArea`, sin una navegación extra. Solo documento: redirigir un
  prefetch/RSC ensucia la caché del router. Leer el parámetro obligó a
  `export const dynamic = "force-dynamic"` en `app/(auth)/login/page.tsx`
  (`useSearchParams` rompía el build, y un `<Suspense>` habría dejado el
  fallback prerenderizado justo en la primera pantalla).
- **La cabecera interna `x-pp-access-token` se borra en todos los
  caminos** (B2): `middleware.ts::passThroughWithoutAccess` clona las
  cabeceras y la quita antes de dejar pasar una petición sin sesión, así
  que un cliente no puede forjarla; los otros dos caminos sin sesión (503
  de red, redirección al login) no propagan la petición.
- **`hooks/useAuth.ts::bootRestoreSession`** memoiza `restoreSession()` a
  nivel de módulo: en StrictMode el inicializador de `useState` de
  `app/providers.tsx` corría dos veces y lanzaba dos refrescos
  concurrentes con la misma cookie — exactamente la carrera de M1, y en
  `next dev`, que es lo que ejecuta el e2e.
- **`retry: false`** es global (`app/providers.tsx`), así que el 5xx del
  route handler de refresco **no** se reintenta: se propaga como error de
  la consulta. Corregidos los dos comentarios de `lib/api/client.ts` y el
  pasaje de «Hardening de sesión» que afirmaban lo contrario (B4).

### Gates de página, rutas de error y sesión por petición

- **Las cinco páginas de entidad que faltaban gatean por
  `entidadMenuFor`** (M2): `personas`, `personas/[userId]`,
  `actividades`, `asistencia`, `asistencia/[eventId]` solo comprobaban
  «tener alguna membresía con panel», así que `analista` y `referente`
  entraban por URL y veían un `ErrorState` 403 en vez del «Sin acceso»
  del resto del panel. Mismo gate literal que `comunidades/page.tsx`.
  `app/plataforma/metricas/page.tsx` no tenía **ningún** gate (era un
  Server Component síncrono, sin sesión): ahora sigue el patrón de
  `plataforma/reportes/page.tsx`. Estos gates no sustituyen al backend
  (que sigue respondiendo 403): evitan pantallas rotas por URL directa.
- **`lib/auth/paraguasMenu.ts::paraguasMenuFor(role)`**: el layout de
  paraguas pintaba las dos secciones para los cinco roles, así que
  `dinamizador`/`referente` veían «Informes» sin poder exportar
  (`exportar_informes`, `docs/PANEL.md` §2.1). Ahora el `<nav>` y el gate
  de `paraguas/[slug]/informes` filtran con la misma función, igual que
  hace `entidadMenuFor` en la entidad.
- **`PLATFORM_ROLES`/`isPlatformRole`** (`lib/auth/plataformaMenu.ts`)
  son la **única** definición de «rol de plataforma» del panel: las usan
  `lib/auth/area.ts::resolveArea`, los tres layouts de área y las once
  páginas de `/plataforma`. Antes cada sitio hacía
  `if (session.platformRole.role)` (comprobación de verdad/falsedad), así
  que un rol que el backend añadiera —o un dato corrupto— dejaba la
  cuenta dando vueltas: `/` → `/entidad/{slug}` → `/plataforma` → `/` →
  … `ERR_TOO_MANY_REDIRECTS`. **Quien añada un quinto rol en
  `safety.PlatformRole` tiene que añadirlo a esa constante**, o la cuenta
  nueva aterrizará en su entidad (o en «sin acceso»), nunca en el área de
  plataforma.
- **`lib/auth/organization.ts::getServerOrganization` y
  `getServerSession` con `cache` de React** (B5): una navegación a
  `/entidad/<slug>` hacía **seis** llamadas al backend (layout y página
  pedían cada uno `/me/`, `platform-roles/me/` y `/organizations/{id}/`);
  ahora tres. En Vitest no cambia nada: fuera de un contexto de petición
  de servidor, `cache()` de React 19 llama a la función tal cual.
- **`app/{not-found,error,global-error}.tsx`** (B7): antes un 404 o una
  excepción de render caían en la pantalla genérica de Next, en inglés y
  sin salida. Las tres usan `EmptyState`/`ErrorState` del panel («Volver
  al inicio», «Reintentar» con `reset()`); `global-error.tsx` lleva sus
  estilos en línea porque sustituye al layout raíz.
- **`app/plataforma/entidades/[id]/page.tsx`** llama a `notFound()` con un
  id no numérico (B8), antes de leer la sesión: pedía
  `/api/organizations/no-soy-un-id/` y pintaba un error de carga dentro
  de la ficha. `test-utils/nextNavigationMock.ts` gana `notFoundMock` con
  su propia señal, como ya tenía el `redirect`.

### Configuración de Next

- **`lib/api/baseUrl.ts::apiBaseUrl()`** (B9) reemplaza los cinco
  `?? DEFAULT_API_URL` duplicados (`lib/api/client.ts`,
  `lib/api/serverFetch.ts`, `middleware.ts` y los dos route handlers de
  sesión). Normaliza la barra final (`https://host//api/...`) y **lanza**
  si falta la variable con `NODE_ENV === "production"`: un despliegue sin
  `NEXT_PUBLIC_API_URL` ahora falla en voz alta en la primera petición en
  vez de apuntar en silencio a `localhost`. Se llama siempre **dentro**
  de la función que hace el `fetch`, nunca a nivel de módulo, para no
  romper `next build` en un entorno que todavía no tiene la variable.
- **`lib/config/imagePatterns.ts`** (M3): `images.remotePatterns` era
  `{hostname: "**"}` en http y https, o sea `/_next/image?url=` como
  proxy abierto a todo internet desde nuestro dominio. Ahora el patrón se
  deriva de `NEXT_PUBLIC_API_URL` (protocolo, host y **puerto** exactos —
  un `port` ausente casa con cualquier puerto en Next) más
  `NEXT_PUBLIC_MEDIA_HOSTS`, una lista de hostnames separada por comas
  para el caso de un CDN con dominio propio. Las tres imágenes remotas
  reales son `org.logo` (cabeceras de entidad y paraguas) y `data.photo`
  (`PersonSheet.tsx`), todas del backend. **Se evalúa al cargar
  `next.config.ts`, así que los dos valores se fijan en el build**: quien
  despliegue tiene que declararlos ahí, no solo en runtime — `.env.example`
  lo dice ahora al lado de cada variable, con lo que pasa si faltan en el
  build: el único host permitido queda `http://localhost:8001` y los logos
  del backend real no se pintan (la cabecera se queda sin logo, no se cae
  la página). Por eso este módulo no usa `apiBaseUrl()` (que lanzaría,
  porque `next build` corre con `NODE_ENV=production`).
  **Revisión final de la rama (F2)**: acotar los patrones dejó un filo
  nuevo, porque `next/image` **lanza en render** si la `src` no casa con
  ninguno («hostname is not configured under images») — un logo con un
  dominio no declarado no dejaba la cabecera sin logo, tumbaba el layout
  entero a `app/error.tsx`. `isAllowedImageSrc(src)` (mismo módulo, misma
  lista, nunca una copia) comprueba protocolo + hostname + puerto, y los
  tres sitios que pintan imágenes remotas (las dos cabeceras y
  `PersonSheet.tsx`) solo montan `<Image>` si pasa; si no, se comportan
  igual que con `logo`/`photo` a `null`. Rutas relativas siempre
  permitidas; cadena vacía, texto ilegible, `data:` y `//host/...`
  rechazados sin lanzar.
- **`lib/config/securityHeaders.ts`** (M3) aplica a `/(.*)`:
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
  `Permissions-Policy: camera=(self), microphone=(), geolocation=()` y
  HSTS solo en producción. `camera=(self)` se conserva a propósito (el
  check-in por QR de `AttendanceView.tsx` llama a `getUserMedia`), con un
  test que lo fija. **Sin CSP, deliberadamente**: Next inyecta scripts en
  línea y una CSP útil exige un nonce por respuesta desde el middleware,
  que es trabajo aparte — hay un test que lo deja fijado para que nadie
  la añada a medias sin darse cuenta.

### Hooks de datos

- **`lib/api/drfError.ts::detailOf`** (M5) es el único lector de errores
  DRF del panel: `detail` → `error` → primer string de cualquier array de
  campo (`non_field_errors` incluido) → `undefined`. El backend valida
  con `is_valid(raise_exception=True)` y responde **por campo**, así que
  19 mutaciones (invitar, alta de equipo, referencias, entidades,
  encuestas, comunicaciones, asistencia, roles, importación, recursos,
  familias, reportes, exportaciones, bajas de equipo y referencia…)
  enseñaban «Revisa los datos…» sin decir cuál. La rama `error` está ahí
  porque tres de esos hooks ya la leían; no puede robar precedencia a un
  error por campo (un campo DRF llamado `error` llega como array). Es la
  **única** función del módulo: hubo un `fieldErrorsOf` (mapa campo →
  primer mensaje) que nunca llegó a tener consumidor y se borró con sus
  tests en la revisión final de la rama, en vez de dejarlo como código
  muerto cubierto.
- **`useEntityCommunities` con tope explícito** (M4): `MAX_PAGES` pasa de
  20 a **250** (× `PAGE_SIZE` 20 del backend = 5000 comunidades) y, si
  `next` sigue no nulo al agotarlas, **lanza** «Hay demasiadas
  comunidades para cargarlas todas; contacta con Popyplan.» en vez de
  devolver un listado truncado que parece completo. El listado es global,
  así que con el tope viejo (400) las comunidades de la entidad a partir
  de esa página desaparecían en silencio de Comunidades, del select de
  Personas, de `AddPersonDialog`, de `hasFamilies` y de Familias.
  **Revisión final de la rama (F5)**: ese recorrido son hasta 250
  peticiones **en serie** y el `staleTime` por defecto de TanStack es 0,
  así que cada montaje de un select de comunidad lo repetía entero. Ahora
  `staleTime: 5 * 60 * 1000`; las mutaciones que crean o cambian una
  comunidad ya invalidan la clave, así que la caché no esconde nada
  recién creado. El arreglo real sigue siendo un filtro `owner_org` en el
  backend (ver «Pendientes conocidos»).
- **Invalidaciones cruzadas** (B10): atender un aviso de ayuda o resolver
  un reporte invalida ya el Inicio de la entidad y
  `["panel-dashboard-stats"]`; marcar asistencia o hacer check-in
  invalida `panel-entity-events` y `panel-person`; asignar/quitar
  referencia y quitar del equipo invalidan `panel-people`/`panel-person`/
  `panel-org-references`. Para poder hacerlo, `useMarkAttendance` y
  `useCheckin` reciben ahora `(eventId, orgId)` — `orgId` no viaja en la
  petición, solo en la clave de caché, y lo hila
  `AttendanceView.tsx` desde la página. Los tests comprueban el
  emparejamiento real (`getQueryState(...).isInvalidated`), no que se
  llamara a `invalidateQueries`: es la única forma de atrapar el fallo
  string↔number que este fichero ya documenta para `useProgram`.
- **`lib/download/{triggerDownload,filenameFrom}.ts`** (B12): las dos
  copias que había (`useExport`, `useProgramReport`) revocaban la URL del
  blob en la misma vuelta del `click()`, lo que cancela la descarga en
  Safari y en Chrome con ficheros grandes — ahora se revoca en el turno
  siguiente, y en un `finally`, así que un `click()` bloqueado no deja un
  `<a>` huérfano. `filenameFromContentDisposition` entiende
  `filename*=UTF-8''…` con preferencia sobre `filename="…"` (RFC 6266
  §4.3) y **exige** ese juego de caracteres: sin él no hay forma de saber
  en qué está codificado el nombre, y la cabecera es inválida.
- **`usePeople` distingue el 404** con `kind: "pagina_inexistente"`
  (B13) y `PersonasTable` vuelve a la página 1 cuando llega estando más
  allá: la tabla se quedaba en un `ErrorState` sin salida, porque los
  botones de paginación desaparecen con él. **`VerificacionesQueue`
  gana la paginación que le faltaba** (B22: el hook ya aceptaba `page`,
  pero la cola solo enseñaba la primera página) y el mismo retorno
  automático, porque se vacía sola según se resuelven revisiones.
  **`usePlatformPendingHelpRequests`** gana `kind: "sin_acceso" |
  "desconocido"` (patrón de `useReportsQueue`), para que su tarjeta del
  Inicio de plataforma se esconda con un 403 y solo diga «No disponible»
  con un fallo real.

### Componentes: formularios, diálogos y textos

- **`ResourceForm` con `key` por recurso** (A3, el bug más grave del
  plan): el estado nacía del `useState` inicial a partir de `editing`, y
  los botones «Editar» de todas las tarjetas siguen activos con el
  formulario abierto. Editar A → Editar B enviaba
  `updateResource.mutate({resourceId: B.id, ...camposDeA})`, es decir,
  **sobrescribía B con los datos de A** (o con el formulario vacío si
  venía de «Nuevo recurso»). `key={editing === "new" ? "new" :
  editing.id}` remonta el formulario. Además `canSubmit` valida enlace
  sin URL y fichero obligatorio al crear, y al editar solo se manda
  `body: ""`/`url: ""` cuando el recurso **guardado** era de ese tipo y
  deja de serlo (el campo no se enseña salvo con su `kind`, así que el
  borrado era invisible para quien editaba).
- **Patrón de error de mutación en un diálogo** (M6-M10, B19, B21),
  aplicado ya en todos: el `error.message` se pinta **dentro** del
  `ConfirmDialog` como `<p role="alert">` en su `description` (que admite
  cualquier `ReactNode`), `reset()` al abrir y al cancelar, y el diálogo
  se cierra **solo** en el `onSuccess` de `mutate`. Antes el aviso
  quedaba detrás del overlay, fuera de la vista, con los botones
  rehabilitados y sin decir qué había pasado (borrar recurso, cerrar
  programa, finalizar contrato, marcar factura pagada, revocar
  invitación, quitar del equipo). En la misma línea, los formularios de
  Equipo y Referencias limpian sus campos en `onSuccess`, no tras
  `mutate` (B14): un 400 dejaba el formulario en blanco y había que
  volver a teclear los ids.
- **`components/ui/Dialog.tsx` con `pending`** (B16): `Escape` y el botón
  × cerraban el diálogo con la mutación en vuelo (el `ConfirmDialog` ya
  lo guardaba). Ahora el guard está en los dos, el contenedor lleva
  `aria-busy={pending}` y todos los «Cancelar» van `disabled`. Los dos
  `Dialog` que envuelven a `ProgramaForm` reciben el estado por una prop
  `onPendingChange` del formulario, porque la mutación vive dentro
  (`useCreateProgram`/`useUpdateProgram` son instancias por componente).
  «Elegir otro fichero» de `ImportPeopleDialog` hace `resetAll()` (B17):
  volvía a la fase de selección con el fichero puesto, así que «Vista
  previa» reenviaba el mismo como si fuera otro.
- **Confirmación en las bajas que faltaban** (M12, B19): «Quitar» del
  Equipo y de Referencias (`ConfiguracionPanel`), «Expulsar»
  (`ComunidadesPanel`, con el diálogo dentro de la propia fila para
  reutilizar su instancia del hook) y las dos «Quitar» de la pestaña
  Equipo de `EntidadDetail`. Quitarse a uno mismo del equipo añade la
  línea «Vas a quitarte a ti mismo del equipo y perderás el acceso al
  panel.» (`currentUserId` llega del Server Component).
- **Nada de valores crudos del contrato** (B20): `lib/reports/labels.ts`
  (`reasonLabel`/`statusLabel`, con reserva al valor crudo si el backend
  añade uno nuevo) sustituye las dos copias idénticas que tenían
  `ReportesQueue.tsx` y `ReportesQueuePlataforma.tsx`; «Asignado a» se
  pinta «Asignado a una persona del equipo»/«Sin asignar», sin id, que es
  lo máximo que permite el contrato (`ReportDetail.assigned_to` es
  `number | null`, sin `assigned_to_display`); y
  `PersonDetail.verification_level` es un **entero 0-3**, no un enum de
  cadenas, así que se etiqueta con los cuatro niveles reales de
  `LevelEnum` (0 sin verificar, 1 teléfono, 2 mayoría de edad, 3
  identidad) con reserva al número.
- **`lib/help/noPhoneNotice.ts`** (B26): la línea «Popyplan no guarda
  teléfonos: contacta con la persona por el chat de la app o a través de
  su referente.» pasa a un módulo compartido y `AyudaPendienteList` la
  pinta en sus cuatro estados (cargando, error, vacío y con avisos),
  igual que `GuardiaPanel` — antes solo la tenía la guardia de la
  entidad, y un aviso de ayuda sin teléfono visible se lee como un dato
  que falta si nadie explica la regla.
- **Consultas auxiliares que fallaban en silencio** (B15): un select
  vacío o una sección en blanco era indistinguible de «no hay datos».
  Ahora avisan los ajustes de guardia (`GuardiaPanel`), el recuento de
  invitaciones, los selects de comunidad y de referente
  (`PersonasTable`/`AddPersonDialog`/`PersonSheet`, con `role="alert"` e
  `aria-describedby` solo mientras el aviso está visible) y el
  `hasFamilies` de Comunicaciones y Recursos — ahí la pista «Disponible
  cuando exista el espacio de familias» **mentía** cuando lo que fallaba
  era la petición. En el Inicio de plataforma, `PlataformaHomeDashboard`
  monta cada tarjeta en su propio componente según `plataformaMenuFor` (y
  las estadísticas de `dashboard-stats` según el rol, porque piden
  `is_staff` y no tienen sección de menú): un `verifier` ya no pide tres
  rutas para recibir tres 403. Un fallo que **no** es 403 pinta «No
  disponible»; esconder la tarjeta se leía como un cero.
- **Accesibilidad**: `aria-pressed` en los cuatro selectores de botones
  (pestañas de `EntidadDetail` y `ContratosPanel`, «Agrupar por» de
  métricas, presets de `PeriodSelector`), donde solo el color marcaba el
  activo (M15); `<th>` con `<span className="sr-only">Acciones</span>` en
  las columnas de acciones (B27, `TableColumn.header` pasa de `string` a
  `ReactNode` para poder hacerlo también en la tabla compartida); `<h2>`
  en vez de `<h3>` en `ComunidadesPanel` (B28, `heading-order`); y el
  «—» de la comparativa pasa a `role="img"` con
  `aria-label="No disponible por umbral de agregación"` (B29), que
  sustituye el contenido del guion por un nombre accesible. Los tres
  primeros los encontró `axe`; los tests nuevos de `axe` suman
  `configuracion`, `comunidades` y las dos colas de `reportes` a la lista
  de páginas cubiertas.
- **`components/ui/Stat.tsx` borrado** (B25): sin ningún consumidor desde
  hace fases, y con `StatCard` haciendo lo mismo. Igual
  `lib/api/types.ts::TokenRefreshResponse`, que se quedó sin uso al
  sustituir su `as` por `parseRefreshedTokens`; y `resourceFormData.ts`
  pierde un ternario cuyas dos ramas eran idénticas (B36). Tres tipos
  manuales de `lib/api/types.ts` dejan de decir que el esquema no los
  cubre: `PersonRowPage`, `AuditLog` y `PaginatedAuditLogList` ya
  existen en `types.generated.ts`, así que los docstrings explican ahora
  la razón real por la que siguen a mano (`results` mezcla
  `InvitedPersonRow`; `ip` es un campo condicional que
  drf-spectacular no declara) y `AuditActor` pasa a ser un alias del
  generado.

### Plataforma, métricas y lógica pura

- **`lib/csv/toCsv.ts`** (B30): la exportación CSV de Auditoría
  concatenaba a mano, así que un `;`, un salto de línea o una comilla en
  `metadata` partía la fila. **El separador es `;`** (no `,`) y el
  fichero lleva BOM: es lo que espera un Excel en configuración regional
  española, igual que las exportaciones que genera el backend.
  Ahora toda celda va entrecomillada con las
  comillas internas duplicadas (RFC 4180), el BOM lo pone `csvBlob` una
  sola vez y las celdas que empiezan por `=`, `+`, `-`, `@`, tabulador o
  retorno llevan un `'` delante (inyección de fórmulas: `action`,
  `target_type` y `metadata` los escribe quien genera la acción
  auditada). **El prefijo solo se aplica a `string`**: hacerlo sobre un
  `number` estropeaba cualquier cifra negativa (`-2` → `'-2`, que deja de
  ser un número para la hoja de cálculo). `AuditoriaPanel::downloadCsv`
  dispara la descarga con `lib/download/triggerDownload.ts` en vez del
  `<a>` que tenía a mano, así que hereda el arreglo del revoke diferido.
- **`lib/billing/tierRange.ts`** (B24) valida el rango de población de un
  tramo (mínimo negativo o no finito, máximo no finito, máximo por debajo
  del mínimo) con el mismo patrón que
  `lib/programs/validation.ts::validateProgramDates`. Vive en `lib/`
  porque los dos campos son `<input type="number">` y el navegador (y
  jsdom) **vacía** el valor ante cualquier cosa que no sea un número, así
  que el caso `NaN` no se puede provocar por la UI: el helper lo deja
  probado donde sí es alcanzable. `FacturaForm` valida además que el
  vencimiento no sea anterior a la emisión, y `TEAM_MANAGER_ROLES`
  (`lib/auth/plataformaMenu.ts`, `superadmin`/`moderator`) oculta los
  formularios de la pestaña Equipo a `verifier`, que los veía y recibía
  403 (B19).
- **`ExportPanel` controlado por el dashboard que lo envuelve** (B23):
  props opcionales `period`/`preset`/`onPeriodChange` — en
  `PlataformaMetricsDashboard` el panel de exportación y las tarjetas
  compartían pantalla con dos periodos distintos, así que se exportaba un
  rango que no era el que se estaba mirando. Sin esas props se comporta
  como antes (así lo usan las dos páginas de Informes, donde va suelto).
  Destapó un quirk real de **`PeriodSelector`**: `customSince`/
  `customUntil` se inicializaban una sola vez desde `value`, así que un
  periodo cambiado desde fuera no llegaba a los dos `<input type="date">`
  y pulsar «Personalizado» mandaba el rango viejo. Ahora un `useEffect`
  con las **dos cadenas** como dependencias (no el objeto) los sincroniza
  sin pisar lo que se esté tecleando.
- **El tope de periodo se mide como diferencia de días** (B31): el
  backend hace `(until - since).days > PERIODO_MAX_DIAS`
  (`panel/viewsets.py`), mientras el panel contaba de forma inclusiva y
  rechazaba de más — `2021-01-01..2025-01-01` (1461 de diferencia) es
  válido y el selector lo negaba. El mensaje lo dice ahora como es: «El
  periodo no puede abarcar más de 1461 días entre las dos fechas (unos 4
  años).».
- **`parseIsoDate` rechaza días que no existen** (B32): `new
  Date("2026-02-31T00:00:00Z")` no falla, devuelve el 3 de marzo, así que
  el panel mandaba al backend una fecha distinta de la escrita. Se
  comprueba el ISO de vuelta (equivalente a comparar año/mes/día, y sin
  ramas muertas: un día inexistente siempre desplaza también el mes) y se
  rechaza el año 0, válido en JS pero no en Python.
- **`previousPeriodLabel` pone el año en las dos fechas cuando
  difieren** (M13, `lib/metrics/compare.ts`): la leyenda de la
  comparativa se leía «frente a 17 sept – 17 sept 2025» para un periodo
  anterior de un año entero (como si fuera de un día), y un plurianual
  perdía el año de inicio.
- **`formatDeltaPct` redondea antes de decidir el signo** (B33): un
  `-0.0001` se pintaba «-0,0 %». **`eurosToCents`** (B34) acepta el
  formato es-ES pegado (`1.234,56`, con espacio normal o irrompible) y
  devuelve `NaN` para negativos; los puntos solo se quitan si hay coma
  decimal, así que `1.234` de un `type="number"` sigue siendo 123
  céntimos.
- **`lib/a11y/contrast.ts` devuelve `null` en vez de `NaN`** (B35):
  `hexToRgb` acepta `#RGB`/`#RRGGBB`/`#RRGGBBAA` (el canal alfa se
  ignora: el contraste WCAG es entre colores opacos) y
  `relativeLuminance`/`contrastRatio`/`readableOn` propagan `null`. El
  bug real: un color de marca en forma corta (`#0a4`) daba `NaN` y la
  cabecera caía al tinte en vez de usarlo — el caso del color no
  parseable ya caía bien, pero **por accidente** (toda comparación con
  `NaN` es falsa). Los dos layouts tratan `null` como un par por debajo
  de 3:1 (tinte `--color-primary-100` + franja de 6 px) y, cuando el
  color no se puede calcular, la franja usa `var(--color-primary)`: un
  `border-bottom: 6px solid <valor inválido>` es una declaración que el
  navegador descarta, y la cabecera se quedaba sin franja.
- **`lib/a11y/useFocusTrap.ts`** (M16): el foco escapaba del diálogo si
  `activeElement` era el `body` (clic en el overlay o en un texto) o si
  no había nada enfocable dentro (un `ConfirmDialog` con `pending`
  deshabilita sus dos botones). Ahora `Tab` con el foco fuera o sin items
  hace `preventDefault()` y enfoca el primer elemento o el contenedor; el
  selector excluye `input[type="hidden"]` y cualquier `tabindex="-1"`; y
  al cerrar, si el opener ya no está en el documento (Revocar, Marcar
  pagada, Finalizar, Verificar…), el foco va a
  `#main-content` en vez de perderse en el `body`. Firma pública sin
  cambios.

### Buscadores con retardo

`hooks/useDebouncedValue.ts` (300 ms por defecto, `setTimeout` reiniciado
en cada cambio y cancelado al desmontar) lo usan `PersonasTable`
(búsqueda, referente y las dos fechas), `EntidadesTable` (búsqueda),
`AuditoriaPanel` (sus seis filtros, que pasan a ser controlados para
poder distinguir el valor tecleado del aplicado) y `RolesPanel` (buscador
de cuentas, por encima del `enabled` de dos caracteres de
`useUserSearch`) — antes cada tecla era una petición: teclear «ana»
pedía `?search=a`, `?search=an` y `?search=ana`. Los `<select>` **no** se
debouncean y mantienen su reset de página inmediato (un evento por
elección; retrasarlo solo añadiría latencia); el reset a la página 1 de
los campos de texto va con el valor **aplicado**, en un `useEffect`.
**Ojo al escribir un test de retardo**: `userEvent` se cuelga con
`vi.useFakeTimers()` en esta suite (el `asyncWrapper` de Testing Library
solo adelanta el reloj si detecta los temporizadores falsos de *jest*),
así que estos tests usan `fireEvent.change` +
`act(() => vi.advanceTimersByTime(300))`, y cada fichero tocado pone
`vi.useRealTimers()` al principio de su `afterEach`. Está explicado con
un comentario en los cuatro ficheros de test.

### CI, e2e y dependencias

`playwright.config.ts` genera los dos reportes
(`[["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]`;
antes CI subía una carpeta que `reporter: "list"` nunca creaba) y el job
`e2e` sube además `test-results/` con las trazas (B37). El workflow se
dispara también en `pull_request` a `develop` y `main`, así que una rama
de trabajo ya pasa por CI antes de fusionarse (B38). `middleware.ts`
entra en `coverage.include` (B39): vive en la raíz, así que ningún patrón
lo alcanzaba, y su propio `middleware.test.ts` lo cubre al 100 %.
`e2e/analista.spec.ts` deja de usar un `getByText("Asistencia")` que
empareja por subcadena con las cabeceras «% asistencia (…)» de la
comparativa, y las dos descargas de informe comprueban el nombre de
fichero completo con `e2e/helpers.ts::expectExportFilename` (B40).
`npm audit fix` (sin `--force`) sube `@redocly/openapi-core`, que deja de
anidar un `js-yaml` vulnerable; quedan los avisos de `postcss` dentro de
Next, que solo se cierran subiendo a Next 16 (rotura, fuera de alcance).

### Revisión final de la rama (F1-F5 y menores)

Revisión completa del diff de la rama (`47664b4..8d7cafe`) sobre el
trabajo ya fusionado: cinco hallazgos de peso y siete menores, todos con
test rojo → verde salvo los puramente documentales (F4 y la parte de
notas de F2).

- **F1. `referente` solo tenía enlaces a una pantalla que su panel le
  niega** (`components/entidad/ActividadesTable.tsx`): `REFERENTE_VISIBLE`
  (`lib/auth/entidadMenu.ts`) no incluye `asistencia` —decisión de
  producto, no se toca—, pero la tabla enlazaba el título de cada
  actividad a `/entidad/{slug}/asistencia/{eventId}`, cuyo gate le
  devuelve «Sin acceso». La tabla recibe ahora `canOpenAttendance`, que
  calcula el Server Component con
  `entidadMenuFor(role).includes("asistencia")` (siempre `true` en
  `asistencia/page.tsx`, que ya está gateada por esa sección); sin
  permiso el título se pinta como `<span>`, sin `<a>`.
- **F2. Guard de host antes de `next/image`** — ver la entrada de
  `lib/config/imagePatterns.ts` en «Configuración de Next» arriba.
- **F3. Carrera de refresco entre runtimes** — ver «Alcance real de M1»
  y el bullet del middleware en «Hardening de sesión» arriba. Decisión:
  el middleware deja de borrar la cookie; no se inventa una caché
  compartida entre Edge y Node.
- **F4. `X-Forwarded-For` sin frontera de confianza** — trade-off
  documentado (no arreglado en este repo), ver la entrada de
  `lib/auth/clientIp.ts` arriba y `.env.example`.
- **F5. `useEntityCommunities` con `staleTime`** — ver su entrada en
  «Hooks de datos» arriba.

Menores:

- **`components/ui/ConfirmDialog.tsx` con `useId()`** en vez de
  `id="confirm-dialog-title"` fijo: hoy ninguna página monta dos a la vez,
  pero nada lo impide, y con el id fijo los dos `aria-labelledby`
  apuntaban al primer `<h2>` del documento y se anunciaban con el mismo
  título.
- **`lib/auth/paraguasMenu.test.ts`** fija literales (`["inicio",
  "informes"]`) en los tres casos positivos: con `[...PARAGUAS_MENU_ITEMS]`
  una sección nueva habría pasado el test sin que nadie decidiera que
  ese rol la ve.
- **`fieldErrorsOf` borrada** de `lib/api/drfError.ts` (sin consumidor).
- **`EntidadDetail::EquipoTab`**: los avisos de `addMember.isError` y
  `createReference.isError` estaban fuera de `canManage`, donde no hay
  formulario que pueda disparar la mutación — ramas muertas, movidas
  dentro.
- **`lib/a11y/contrast.test.ts`**: dos aserciones con `?? 0` /
  `?? "#FFFFFF"` habrían pasado con un `null` inesperado; ahora
  comprueban que no es nulo antes de comparar.
- **`.github/workflows/ci.yml`** con `concurrency` +
  `cancel-in-progress`: dos empujones seguidos a la misma rama ya no
  dejan dos tandas completas (con su `e2e` y su backend) compitiendo. El
  solape push+PR de la misma rama sigue siendo posible (son dos
  `github.ref` distintos), y está explicado en el propio comentario del
  fichero.
- **`components/metrics/ExportPanel.tsx`**: las props de periodo pasan a
  unión discriminada (`{period; preset; onPeriodChange}` o los tres
  `undefined`), así un `period` sin `onPeriodChange` es error de
  compilación en vez de un selector que no cambia nada. Los dos
  consumidores sueltos (las dos páginas de Informes) no pasan ninguno de
  los tres, así que no cambian. Hay un test de tipos con
  `@ts-expect-error` que falla si alguien deshace la unión.

### Pendientes conocidos (no son bugs, son deuda anotada)

- **`components/plataforma/ContratosPanel.tsx` pasa de 700 líneas.** El
  corte natural son sus tres `*Tab` (`ContratosTab`/`TramosTab`/
  `FacturasTab`) a ficheros propios: ya son componentes independientes
  con su propio estado. No se hizo aquí para no mezclar un movimiento de
  ficheros con las correcciones.
- **Ids estáticos en los avisos de error** de selects y formularios
  (derivados del id del control, no de `useId()`): válidos mientras cada
  uno de esos componentes sea único por página, que hoy lo es. Quien
  monte dos instancias a la vez tiene que pasar a `useId()`.
- **Las regiones `role="status"`/`role="alert"` se montan junto al
  mensaje**, no antes: un lector de pantalla puede perderse el primer
  anuncio. Lo correcto es una región vacía persistente por vista; es un
  cambio de patrón, no un arreglo puntual.
- **«Rechazar» una solicitud pendiente de comunidad** (`ComunidadesPanel
  ::PendingRow`) sigue sin confirmación. Es reversible (la persona puede
  volver a solicitar), pero rompe la coherencia de M12.
- **`hooks/useOrgMembers.ts` no tipa su 403.** Distingue el caso solo en
  el *mensaje* («Solo el titular puede ver el equipo de la entidad.»),
  así que ningún componente puede reaccionar a él sin comparar cadenas.
  Añadirle `kind: "sin_acceso" | "desconocido"` (como `PersonError`)
  dejaría salir solos los textos específicos de los selects de referente.
- **Filtro `owner_org` en `GET /api/communities/`, del repo backend.**
  Sin él, `hooks/useEntityCommunities.ts` recorre el listado global
  página a página (hasta 250 peticiones en serie) y filtra en el cliente;
  el `staleTime` de 5 minutos (F5) solo hace que ese recorrido no se
  repita en cada montaje.
- **Refresco de sesión sin caché compartida entre runtimes** (F3): el
  single-flight y el `rotationCache` valen dentro de cada proceso. Una
  caché compartida (Redis o equivalente) cerraría también la carrera
  entre el middleware Edge y el route handler Node, y entre instancias;
  mientras no exista, la mitigación es que solo el route handler borre la
  cookie.
- **B6, del repo backend**: cada navegación rota el refresh y deja una
  fila en `OutstandingToken`/`BlacklistedToken`. Sin un
  `flushexpiredtokens` periódico, esas tablas crecen sin techo.

## Ayuda por pantalla (2026-09-19)

Botón «?» en la cabecera de las tres áreas (`components/help/PageHelp.tsx`,
`"use client"`, montado justo antes de `<LogoutButton />` en
`app/entidad/[slug]/layout.tsx`, `app/paraguas/[slug]/layout.tsx` y
`app/plataforma/layout.tsx`): al pulsarlo abre un diálogo
(`components/ui/Dialog.tsx`, foco atrapado, `Escape` cierra, el foco
vuelve al botón) con el resumen de para qué sirve la pantalla actual,
qué se puede hacer en ella y quién la ve.

- **Registro**: `lib/help/pageHelp.ts::PAGE_HELP`, una entrada
  (`PageHelpEntry {route, title, summary, actions, audience}`) por cada
  `page.tsx` real de `app/entidad/[slug]/**`, `app/paraguas/[slug]/**`
  y `app/plataforma/**` — 32 pantallas (19 entidad, 2 paraguas, 11
  plataforma), textos en español, literales (nunca construidos por
  concatenación: la internacionalización, cuando llegue, los extraerá
  igual que el resto de la UI).
- **Resolución de ruta**: `routeToRegExp(route)` convierte una plantilla
  con segmentos dinámicos (`/entidad/[slug]/personas/[userId]`) en una
  expresión regular anclada de principio a fin, con barra final
  opcional; `matchPageHelp(pathname)` devuelve la primera entrada de
  `PAGE_HELP` cuya plantilla casa con el `pathname` real de
  `usePathname()`, o `null`. Las 32 plantillas reales nunca colisionan
  entre sí (difieren en algún segmento literal), así que no hace falta
  desempatar por especificidad.
- **Test de completitud** (`lib/help/pageHelp.test.ts`): recorre de
  verdad el árbol de `app/` (sin *glob* de terceros, con el propio
  sistema de ficheros) y falla si aparece un `page.tsx` nuevo bajo esas
  tres áreas sin entrada en `PAGE_HELP`, o si `PAGE_HELP` tiene una
  entrada huérfana sin fichero — así ninguna pantalla nueva se queda sin
  ayuda sin que alguien lo decida explícitamente.
- **Decisiones (ya tomadas, ver el plan
  `docs/superpowers/plans/2026-09-19-ayuda-por-pantalla.md`)**:
  1. El botón vive en la cabecera de área, junto a «Cerrar sesión» — una
     sola inserción por layout, misma posición siempre; ninguna
     `page.tsx` se toca.
  2. El registro indexa por plantilla de ruta, no por `<h1>`: las
     páginas son Server Components y el botón vive en el layout
     (cliente), así que `usePathname()` es la única fuente fiable de
     «qué pantalla es».
  3. Las pantallas fuera de las tres áreas (`/login`, `/accesibilidad`,
     `/elegir-entidad`, `/`) no llevan ayuda: no tienen esta cabecera y
     su función es evidente; `matchPageHelp` devuelve `null` para ellas
     y `PageHelp` no pinta nada.
  4. Sin persistencia ni «no volver a mostrar»: es ayuda bajo demanda,
     no un tour guiado.
  5. Un texto por pantalla, no por rol: cuando una acción es solo de
     titular/moderador (o de otro rol concreto), el propio texto lo dice
     («Solo titular y moderador pueden…»), en vez de tener variantes por
     rol del mismo registro.
- **Accesibilidad**: botón redondo 40×40 con `aria-label="Ayuda: <título>"`,
  `aria-haspopup="dialog"`, `aria-expanded`, el signo «?» en
  `aria-hidden`. **Fondo blanco** (`bg-white text-primary-700 border
  border-border hover:bg-primary-100`), no `text-primary-700` a secas
  sobre el fondo de la cabecera: la regla de contraste de este fichero
  («todo texto usa `primary-700`») está tabulada contra
  `--color-background` (blanco), y aplicarla directamente sobre el
  fondo de marca de la cabecera la invertía — con la entidad más común
  (sin `primary_color` propio, cabecera a `primary-700`) el glifo
  quedaba del mismo color que su fondo, invisible (1,00:1); revisión
  final antes de mergear la rama. El botón lleva su propio fondo blanco,
  igual que «Cerrar sesión» (`Button variant="secondary"`), así
  funciona sobre cualquier color de cabecera; `components/help/
  PageHelp.test.tsx` fija `bg-white` en su className para que la
  regresión no vuelva a colarse (`axe` no la detecta:
  `test-utils/axe.ts` desactiva `color-contrast`). El diálogo pinta el
  resumen, un `<h3>Qué puedes hacer aquí</h3>` con la lista de acciones
  (por debajo del `<h2>` que ya pone `Dialog` en el título, sin saltar
  de nivel) y «Quién la ve: …», y se cierra solo si cambia el
  `pathname` (`useEffect(() => setOpen(false), [pathname])`) — sin eso,
  una navegación con el diálogo abierto (atrás/adelante del navegador,
  o un enlace dentro del propio diálogo) lo dejaba abierto mostrando ya
  el contenido de la pantalla nueva. `components/help/PageHelp.test.tsx`
  cubre el caso sin entrada (no renderiza nada), el botón cerrado, abrir
  el diálogo con su contenido, cambiar de pathname con el diálogo
  abierto (se cierra), `Escape` (cierra y devuelve el foco) y `axe` sin
  violaciones cerrado y abierto; los tres `layout.test.tsx` ganan una
  aserción del botón (`getByRole('button', {name: /^Ayuda:/})`) fijando
  `usePathname()` a una ruta con entrada
  (`test-utils/nextNavigationMock.ts::setPathname`, mismo patrón que
  `setSearchParams`).

## Internacionalización (i18n)

Spec de diseño (autoridad de las tres decisiones de abajo, compartida con
`popyplan`/`popyplan-mobile`):
`~/Code/popyplan/docs/superpowers/specs/2026-09-19-i18n-es-eu-ca-design.md`.
Plan de este repo:
`docs/superpowers/plans/2026-09-19-i18n-panel.md` (6 tareas; esta sección
documenta la Tarea 1, infraestructura — las tareas 2-6 extraen los
literales de componentes/hooks área por área, sin tocar nada de lo de
aquí salvo para consumirlo).

**Idiomas:** `es` (por defecto), `eu`, `ca` — los tres que se ofrecen a
las personas (`lib/i18n/languages.ts::SUPPORTED_LANGUAGES`). El inglés
(`messages/en.json`) es la **cadena fuente** del código (decisión 2 del
diseño: «el backend tiene que ser en inglés, el desarrollo de código en
inglés siempre») y entra en el test de paridad, pero **nunca** se ofrece
como idioma de interfaz. Euskera en batua (Euskaltzaindia); catalán en
la forma general del IEC — glosario compartido en
`docs/i18n/glosario.md` (copia del glosario del backend, que es la
fuente si cambia).

**Convención de extracción (todo texto de UI, tareas 2-6):** cada
literal de un componente/hook pasa por `t()` (`useTranslations`/
`getTranslations` de `next-intl`); las claves son jerárquicas en
minúsculas con puntos (`area.pantalla.elemento`, p. ej. `common.cancel`,
`entidad.personas.title`), nunca claves dinámicas construidas por
concatenación salvo un mapa explícito con todas las variantes
(`Record<Role, string>` de claves). El valor de `es.json` es
**exactamente** el literal que había antes de la migración — nada se
reescribe salvo concatenaciones/plurales, que pasan a mensajes ICU
(`{count, plural, one {…} other {…}}`, soportado nativamente por
`next-intl`); una redacción que convenga mejorar se anota en
`docs/i18n/PENDIENTES.md` en vez de cambiarse de paso.

**Sin enrutado de idioma** (decisión 7 del diseño): `next-intl` v4
(`next.config.ts::createNextIntlPlugin('./i18n/request.ts')`) sin
segmento `[locale]` en las rutas — el middleware de sesión, los layouts
y los e2e no cambian de estructura. `i18n/request.ts`
(`getRequestConfig`) resuelve el idioma con
`lib/i18n/serverLanguage.ts::getServerLanguage` (cookie `pp_lang` vía
`cookies()` → `Accept-Language` vía `headers()`, ambas de
`next/headers` → `es`) y carga `messages/<locale>.json`. `app/layout.tsx`
(Server Component) llama a `getLocale()`/`getMessages()` para
`<html lang>` y envolver `children` en `NextIntlClientProvider`.

**Cookie de idioma** (`lib/i18n/cookie.ts`, decisión 2): `pp_lang`, **no**
`httpOnly` (el selector de idioma y `document.documentElement.lang` la
necesitan legible desde el cliente), `SameSite=Lax`, `path=/`, un año de
vida. `POST /api/lang {lang}` (`app/api/lang/route.ts`) la fija —
`lang` fuera de los tres soportados → 400 `{detail}`; con uno válido,
204 y `Set-Cookie`. `lib/i18n/cookie.ts::resolveLanguage({cookie,
acceptLanguage})` es la única función que decide el idioma de una
petición (cookie → `Accept-Language`, tomando el primer idioma de la
lista con calidad cuyo código base esté soportado → `es`); la usan tanto
`i18n/request.ts`/`serverFetch.ts` (vía `getServerLanguage`, con
`next/headers`) como `middleware.ts` y las dos rutas de sesión (vía
`lib/i18n/requestLanguage.ts::requestLanguageHeader(request)`, que lee
directamente `NextRequest.cookies`/`.headers` — necesario en el
middleware, que corre en Edge y no puede usar `next/headers`).

**`Accept-Language` en todas las peticiones al backend** (decisión 5):
`lib/api/client.ts::apiFetch`/`fetchWithAuth` (cliente) la mandan igual
que `document.documentElement.lang`; `lib/api/serverFetch.ts` (Server
Components/Route Handlers) y las cuatro llamadas de auth que hacen
`fetch` a mano (`app/api/session/route.ts` login/logout,
`app/api/session/refresh/route.ts`, el refresco de `middleware.ts`) la
mandan resuelta contra la petición entrante. Los `detail` que devuelve
el backend siguen mostrándose tal cual (`lib/api/drfError.ts` no
cambia): el backend es quien decide en qué idioma responde según esa
cabecera.

**Formateadores por idioma** (decisión 4): `lib/i18n/locale.ts::localeFor`
mapea `es→es-ES`, `eu→eu-ES`, `ca→ca-ES`; `activeLanguage()` lee
`document.documentElement.lang` en el cliente (fijado por
`app/layout.tsx` desde la cookie) y cae a `es` sin `document` (primer
render de un Client Component en el servidor, sin hidratar todavía).
`lib/metrics/format.ts` y `lib/programs/money.ts` construyen su
`Intl.NumberFormat` así, con un formateador cacheado por idioma (`Map`)
en vez del `Intl.NumberFormat("es-ES", …)` fijo de antes. **El aspecto
de ningún número cambia**: `es-ES`/`eu-ES`/`ca-ES` comparten el mismo
separador de millares (`.`) y decimal (`,`), comprobado antes de escribir
el módulo — por eso los tests numéricos existentes no se tocaron, solo
ganaron un caso por idioma que fija que siguen iguales.

**Patrón de tests** (fijado en `test-utils/render.tsx`/`vitest.setup.ts`,
tarea 1, para que las tareas 2-6 no tengan que inventarlo cada vez):

- `next-intl/server` (`getLocale`/`getMessages`/`getTranslations`) **no
  se puede invocar de verdad bajo Vitest+jsdom**: el paquete resuelve a
  su condición `react-client`, que lanza `` `getRequestConfig` is not
  supported in Client Components `` en cuanto algo la importa fuera del
  runtime real de Next (verificado al escribir esta tarea). Por eso
  `vitest.setup.ts` mockea **todo** el módulo `next-intl/server`, igual
  patrón que el mock ya existente de `next/navigation`: resuelve
  `getLocale`/`getMessages` a `es`/`messages/es.json` y `getTranslations`
  a un traductor construido con `createTranslator` de `use-intl/core`
  contra ese mismo catálogo real (nunca cadenas inventadas, y `onError`
  relanza el error, para que una clave que falte rompa el test que la
  usa) — **fix round 1** (revisión del coordinador de la tarea 1): la
  primera versión interpolaba `{name}` a mano con una expresión regular y
  no entendía ICU `plural`/`select`, así que un mensaje como
  `"{count, plural, one {# elemento} other {# elementos}}"`
  (`messages/*.json::common.items`, añadida como caso de prueba) se
  habría visto crudo en un Server Component de las tareas 3-5;
  `createTranslator` es la misma pieza que usa `next-intl` tanto en
  `getTranslations` real como en `useTranslations`/`NextIntlClientProvider`
  del lado de cliente (que sí corre de verdad en los tests, ver el punto
  siguiente), así que el formateo ICU del mock es idéntico al del
  runtime. `test-utils/render.test.tsx` prueba el plural extremo a
  extremo (`count: 1` → «1 elemento», `count: 3` → «3 elementos»).
- Un componente de **cliente** con `useTranslations` se prueba con
  `render()` normal (`test-utils/render.tsx`): envuelve en
  `NextIntlClientProvider locale="es" messages={es}` con el catálogo real
  (`messages/es.json`), así el idioma por defecto de los tests sigue
  siendo `es` y ninguna aserción de texto existente cambia (decisión 2:
  «`es` es el idioma por defecto en tests»).
- Un **Server Component** (`page.tsx`) que use `getTranslations`/
  `getLocale` se sigue probando con el patrón que ya usan las páginas de
  servidor de este repo: `const element = await Page({ params });
  render(element)` (ver p. ej. `app/entidad/[slug]/page.test.tsx`) — con
  el mock de arriba puesto, `getTranslations()` dentro de esa página
  funciona sin más. `test-utils/render.tsx::renderServer(elementPromise)`
  es el envoltorio de esas dos líneas, para no repetirlas.
- `lib/i18n/messages.test.ts` (paridad, decisión 9): las cuatro claves
  hoja de `messages/{en,es,eu,ca}.json` coinciden exactamente, ningún
  valor vacío, y los mismos parámetros ICU de nivel superior por clave
  (`extractIcuArgs` cuenta llaves para saltar el texto literal de las
  ramas `one`/`other` de un plural, así no se confunde con otro
  parámetro). Verde al final de cada tarea de extracción (2-6).

**Cuando el contrato del backend traiga `preferred_language`
(`GET/PATCH /api/users/users/me/`, decisión 2 del diseño), la tarea 6 lo
consume** (`hooks/useAuth.ts` al entrar; el selector de idioma hace el
`PATCH`) — no está aquí todavía: la Tarea 1 solo monta la infraestructura
del lado del panel.

**Errores de `hooks/` (patrón fijado en la tarea 3, para las tareas 4-6):**
un hook de datos es `.ts` plano — no puede llamar a `useTranslations`, un
hook de React — así que sigue construyendo su clase de error con `kind`
(el código corto que ya tenía, p. ej. `sin_acceso`/`desconocido`) y
`message` en español tal cual (nunca se quita: lo comprueban los tests
del propio hook, y algunos componentes de otras tareas todavía no
traducidos siguen leyéndolo). El componente, que sí tiene `t()`, es quien
decide qué texto pintar: `lib/i18n/errorKindText.ts::errorKindText(error,
keys, t, fallbackKey)` — `keys` es un `Record<Kind, string>` de claves de
traducción (el mapa explícito que permite la regla de «sin claves
dinámicas»), y `fallbackKey` cubre un `kind` sin reconocer (un mock de
test que solo pone `.message`, o un valor nuevo que el mapa todavía no
cubre). Cuando el hook combina el `detail` verbatim del backend
(`detailOf(error)`) con un mensaje de repuesto propio (los que ya seguían
el patrón `detailOf(error) ?? "<mensaje del hook>"`), la clase de error
gana un campo `detail?: string` **además** de `message` (nunca lo
sustituye) — se rellena solo cuando `detailOf` encontró algo, y
`errorKindText` le da prioridad sobre la traducción por `kind`: el texto
del backend nunca se traduce ni se sustituye. Ejemplo
(`hooks/useMarkAttendance.ts`):

```ts
const detail = detailOf(error);
return new MarkAttendanceError("invalido", detail ?? "No se pudo marcar la asistencia.", detail);
```

y en el componente (`components/entidad/AttendanceView.tsx`):

```ts
const MARK_ATTENDANCE_ERROR_KEYS = {
  invalido: "errors.markAttendance.invalido",
  no_inscrita: "errors.markAttendance.noInscrita",
  sin_permiso: "errors.markAttendance.sinPermiso",
  desconocido: "errors.markAttendance.desconocido",
} as const;
// …
errorKindText(error, MARK_ATTENDANCE_ERROR_KEYS, t, "errors.markAttendance.desconocido")
```

Las claves de estos hooks viven bajo `errors.<hook>.<kindEnCamelCase>`
(namespace nuevo de la tarea 3, junto a `entidad.<screen>.*` y
`people.*`) — un hook compartido entre componentes de varias tareas
(p. ej. `useEntityCommunities`, que también consumen `ComunicacionesPanel`/
`RecursosPanel`/`FamiliasPanel`, todavía sin tocar) puede ganar su `kind`
en una tarea y que otro componente lo traduzca en la suya, sin romper
nada mientras tanto — el componente no tocado sigue leyendo `.message`
tal cual (en español, hasta que le llegue su turno). Dos hooks quedan
**deliberadamente fuera** de este patrón por ahora, con literales en
español todavía sin extraer: `hooks/useInvitations.ts` (sus dos mensajes
no los pinta nadie — `PersonasTable.tsx::PendingInvitationsHint` tiene su
propio texto estático de error, ignora `.message`, así que traducir un
mensaje que ningún componente muestra no tenía sentido) y
`hooks/useOrgMembers.ts` (sus únicos consumidores que leen `.message`,
`ConfiguracionPanel.tsx`/`EntidadDetail.tsx`, son de las tareas 4/5; los
dos consumidores de la tarea 3, `AddPersonDialog`/`PersonSheet`, solo
miran `.isError`). Función pura fuera de un hook con el mismo problema
(no puede llamar a `t()`): `lib/support/relationshipLabel.ts` devuelve
ahora la **clave** de traducción (`relationshipLabelKey`, `null` si el
backend manda una relación nueva) en vez del texto, y
`lib/people/validateImportFile.ts` devuelve un `kind` corto
(`ImportFileErrorKind`) en vez del mensaje — mismo criterio en los dos
casos, quien llama (el componente) traduce.

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

- Vitest mide líneas sobre `lib/**`, `hooks/**`, `app/**/*.ts` (route
  handlers y helpers) y `middleware.ts` (añadido en la segunda ronda de
  auditoría: vive en la raíz, así que ningún patrón lo alcanzaba); nunca
  `.tsx` de páginas/layouts/componentes, que se prueban por
  comportamiento, no por cobertura — `components/metrics/*.tsx` y
  `components/entidad/*.tsx` tampoco cuentan. Umbral con ratchet en
  `vitest.config.ts` (`coverage.thresholds.lines`): **100 % al cerrar
  W1, W2 y W3** (umbral fijado a 99.7, real menos 0.3); solo puede
  subir. Objetivo final del plan de cobertura: ≥98 % (ya superado aquí).
  Real al cerrar W4/W5: **99,89 %** (1964/1966 líneas, sin cambios entre
  ambas tareas — W5 solo añade specs de Playwright, que no cuentan para
  esta métrica). Tras la auditoría de bugs de 2026-09: **99,84 %**. Tras
  la segunda ronda (2026-09-18, `middleware.ts` incluido): **99,86 %**
  (2206/2209 líneas). Tras la revisión final de la rama (F1-F5 y
  menores): **99,86 %** (2205/2208 líneas, 1375 tests). Tras la Fase 7
  (red de apoyo, revisión final incluida): **99,86 %** (2225/2228
  líneas, 1418 tests, 162 ficheros). Tras la Tarea 1 de i18n
  (infraestructura `next-intl`, sin extraer literales todavía): **99,86 %**
  (2287/2290 líneas, 1544 tests tras el fix round 1 del mock de
  `next-intl/server`, 173 ficheros). Tras la Tarea 3 de i18n (personas,
  comunidades, actividades y asistencia desde catálogos — la Tarea 2 no
  dejó su propio número en esta lista): **99,87 %** (2372/2375 líneas,
  1585 tests, 174 ficheros). Tras la Tarea 4 de i18n (comunicaciones,
  encuestas, recursos, familias, programas, reportes, guardia y
  configuración desde catálogos): **99,87 %** (2416/2419 líneas, 1590
  tests, 174 ficheros — mismo número de ficheros que la Tarea 3: ningún
  fichero nuevo, solo hooks/componentes/tests ya existentes tocados). El
  umbral fijado sigue en 99,7 porque real menos 0,3 (99,57) queda por
  debajo, así que el ratchet no sube.
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
