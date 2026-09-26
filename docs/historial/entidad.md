# Historial — Área de entidad (operativa, personas, comunicaciones, familias, red de apoyo, programas, actividades)

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

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
`biblioteca/page.tsx`) ven los botones «Añadir persona»
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
- **Biblioteca (antes Recursos)** (`biblioteca/page.tsx` → `RecursosPanel`, hooks
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

**Logo de la entidad (2026-09-20)**: el mismo camino sirve para
`Organization.logo` (`ImageField`, en la lista blanca del `PATCH` del
titular desde antes de P6, pero el panel solo lo mostraba). Configuración
(`ConfiguracionPanel.tsx::DatosEntidad`) tiene ahora un `<input
type="file">` «Logo»: `lib/organizations/validateLogo.ts` valida en el
cliente (`png`/`jpg`/`jpeg`/`webp`, 2 MB — límite del panel, el backend
no impone tamaño; un SVG se rechaza porque Pillow no lo abre) y
`hooks/useUpdateOrganization.ts::buildOrganizationPayload` manda un
`FormData` con el resto de campos como cadenas solo cuando hay fichero;
sin él, el JSON de siempre. El logo se guarda con el botón «Guardar» del
formulario, no al elegirlo; la URL que devuelve el backend cae en
`MEDIA_URL` del mismo host de la API, así que `isAllowedImageSrc` la
admite en las cabeceras. Verificado contra el backend real con un PNG
generado (`PATCH` multipart → 200 con `logo` en `/media/entities/logos/`).

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
**Al día (auditoría 2026-09-21)**: `dinamizador` pierde además Personas y
Guardia, que el backend le niega — ver «Auditoría de integración» abajo.

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
  `/biblioteca`, `/actividades`). Banner explícito, misma cadena literal
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
- **«Nueva comunidad de familias»** (`hooks/useCreateCommunity.ts`,
  `POST /api/communities/ {name, description?, visibility?,
  code_of_conduct?, space, owner_org}`): mismo endpoint general de
  comunidades que `ComunidadesPanel.tsx` (§8.1: solo una comunidad con
  `owner_org` puede marcarse `families`, y el espacio no se puede
  cambiar después de crearla). Solo titular/moderador; diálogo con
  nombre, descripción, visibilidad (abierta/con solicitud/privada) y
  código de conducta, mismo patrón de `Dialog.tsx` que
  `AddPersonDialog.tsx`. **«Nueva comunidad» de la propia sección
  Comunidades (encargo del propietario, 2026-09-20) reutiliza el mismo
  diálogo** — ver el bullet siguiente.
- **«Nueva comunidad» en Comunidades** (`components/entidad/
  ComunidadesPanel.tsx`): mismo `canManage` (titular/moderador) que el
  resto de secciones gestionadas ve un botón «Nueva comunidad» encima de
  la lista (también en el estado vacío, para poder crear la primera) que
  abre `components/entidad/NuevaComunidadDialog.tsx` con `space:
  'members'` en vez de `'families'` — el diálogo, extraído de
  `FamiliasPanel.tsx` donde nació, es el único que existe para las dos
  secciones; solo cambian el título (`entidad.comunidades.
  newCommunityTitle` «Nueva comunidad» / `entidad.familias.
  newCommunityTitle` «Nueva comunidad de familias») y una frase de ayuda
  bajo el título solo para `members`
  (`entidad.comunidades.newCommunityHint`) — las etiquetas de los campos
  y las tres opciones de visibilidad siguen en `entidad.familias.*`
  (genéricas de cualquier comunidad, nunca mencionan familias). Mismo
  endpoint `POST /api/communities/` de arriba, con `space: 'members'`;
  al crearla con éxito se selecciona sola en la lista
  (`onCreated`, sin tener que buscarla tras el refresco).
  `hooks/useCreateCommunity.ts` (generalizado desde el antiguo
  `useCreateFamiliesCommunity`, que solo admitía `space: 'families'`)
  invalida siempre `panel-entity-communities` y, solo con `space:
  'families'`, además `panel-families-summary` — una comunidad de
  miembros no aparece en el resumen de Familias.
- **«Editar» en Comunidades** (encargo del propietario, 2026-09-20: «no
  puedo editar la comunidad que he creado»): mismo `canManage`, botón
  junto al nombre de la comunidad seleccionada que abre
  `components/entidad/EditarComunidadDialog.tsx` — `PATCH
  /api/communities/{id}/ {name, description, visibility,
  code_of_conduct}` (`hooks/useUpdateCommunity.ts`, mismo criterio de
  permiso que crear). **`space` nunca se edita**: el backend lo rechaza
  tras crear la comunidad (`validate_space`), así que el formulario no lo
  ofrece. `EntityCommunityRow` (el listado) no trae `code_of_conduct`, así
  que el diálogo pide primero la ficha completa (`hooks/useCommunity.ts`,
  `GET /api/communities/{id}/`) y solo monta el formulario cuando llega
  (loading/error dentro del propio diálogo); el «Guardar cambios» queda
  deshabilitado hasta que algo cambie respecto a esos valores de partida.
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

## Crear/editar/cancelar actividades desde el panel (2026-09-23)

Encargo del propietario: «una asociación tiene que poder crear sus
actividades desde el panel, no solo desde el móvil». `app/entidad/[slug]/
actividades/` gana alta, edición y cancelación; reutiliza la API general
de `/api/events/` (`events/viewsets.py::EventViewSet`) — no hay (ni hace
falta) una ruta de `panel/` para escribir, solo para leer (`PANEL.EVENTS`,
`hooks/useEntityEvents.ts`, sin cambios).

- **Permiso**: `publicar_actividades` (`entities/permissions.py`) —
  titular, moderador, dinamizador y referente; **nunca** analista (solo
  lectura). `app/entidad/[slug]/actividades/page.tsx::
  ENTITY_EVENT_MANAGE_ROLES` lo calcula en el Server Component y lo pasa
  como `canManage` a `ActividadesTable` (mismo patrón que
  `canOpenAttendance`); `asistencia/page.tsx` reutiliza la misma tabla
  solo como selector de actividad y pasa siempre `canManage={false}` —
  gestionar actividades no es su propósito ahí.
- **Toda actividad creada desde el panel nace sellada por la entidad**
  (`owner_org: orgId`, invariante 2): el formulario no ofrece ese campo,
  lo añade `hooks/useEventMutations.ts::useCreateEvent` a partir del
  `orgId` con el que se instancia el hook. `audience` es
  abierta/comunidad/solo-entidad (`anyone`/`community`/`organization`);
  con `community` solo viaja si `audience === 'community'` (mandarlo con
  otra audiencia validaría de más, `events/services.py::create_event`) y
  con `organization` basta el sello ya presente — no hace falta ningún
  campo adicional (`create_event` exige `owner_org` para esa audiencia,
  que siempre está).
- **Edición, con el espacio bloqueado**: `EventUpdateSerializer` (backend)
  excluye `audience`/`community`/`owner_org`/`recurrence_rule` — cambiar
  el espacio de una actividad a mitad de camino dejaría dentro a gente
  que ya no puede estar (se cancela y se crea otra). `lib/api/
  types.ts::EventUpdateFields` los excluye por tipo (`Omit`, error de
  compilación si alguien intenta mandarlos en un `PATCH`);
  `ActividadForm.tsx` los pinta de solo lectura al editar.
  **`starts_at` solo viaja si cambió**: el backend lo valida como futuro
  también al editar (`EventCreateSerializer.validate_starts_at`, heredado
  por `EventUpdateSerializer`), así que reenviar el valor sin tocar de
  una actividad ya empezada devolvería un 400 que no tiene nada que ver
  con lo que la persona quería corregir (mismo criterio que
  `popyplan-mobile/app/_containers/events/NewEvent/
  createEventPayload.ts::buildUpdateEventPayload`, solo lectura, que
  inspiró este patrón: ahí compara por minuto con `sameMinute`, aquí
  basta comparar el ISO reconstruido porque el formulario no rehidrata
  segundos). Sin este cuidado, corregir una errata del título de una
  actividad de esta mañana habría dado el mismo 400 que ya documentó la
  auditoría de la app.
- **`hooks/useEventMutations.ts`** (`useCreateEvent`/`useUpdateEvent`/
  `useCancelEvent`, 100 % líneas): `POST/PATCH /api/events/`,
  `POST .../cancel/`. Tres `kind` de error, no cuatro como Programas —
  aquí no hay un 409 de transición de estado (cancelar o editar una
  actividad ya cancelada/celebrada no está bloqueado en
  `events/services.py`): `invalido` (400), `sin_permiso` (403, no eres
  organizador ni tienes `publicar_actividades` en la entidad que sella la
  actividad —`events/permissions.py::IsOrganizerOrReadOnly`—) y
  `no_encontrado` (404). El mensaje del backend viaja literal cuando lo
  trae (`detailOf`), mismo patrón que `useProgramMutations.ts`. Las tres
  invalidan `["panel-entity-events", orgId]` (sin clave aparte para el
  Inicio de la entidad: `useEntityHome.ts` ya compone sus «actividades de
  hoy» con `useEntityEvents`, así que invalidar ese prefijo basta).
- **`hooks/useEvent.ts`** (lectura, `GET /api/events/{id}/`): `
  EntityEventRow` (la fila del listado, `hooks/useEntityEvents.ts`) no
  trae `description`/`ends_at`/`latitude`/`longitude`/`place`, así que
  editar necesita el detalle completo antes de poder prellenar el
  formulario — `components/entidad/ActividadForm.tsx` resuelve esa carga
  (estado «cargando»/`ErrorState`/formulario) y delega el formulario real
  en un componente interno que solo se monta, con `key={editing}` (mismo
  remedio que el hallazgo A3 de `ResourceForm.tsx`), cuando el detalle ya
  llegó.
- **Coordenadas y municipio**: el backend deriva el municipio de la
  actividad a partir de `latitude`/`longitude` en el propio
  `Event.save()` (`places/services.py::derive_place`) — el panel nunca
  manda un código INE directamente, solo las coordenadas del municipio
  elegido. El picker de `ActividadForm.tsx` reutiliza `hooks/
  usePlaces.ts::useSearchPlaces` (no `components/plataforma/
  SedeSelector.tsx`, que es un componente entero con su propio rótulo
  «Sede» — aquí basta la búsqueda con `useDebouncedValue`, sin las partes
  específicas de sede obligatoria de plataforma) y guarda en estado tanto
  el código INE como la latitud/longitud de `PlaceRow`, para no tener que
  resolverlas de nuevo al enviar. Al editar, el municipio ya guardado se
  lee directamente de `EventDetail.place`/`latitude`/`longitude` (sin una
  consulta adicional tipo `usePlacesByIne`: el detalle ya trae nombre,
  provincia y coordenadas). `lib/events/coords.ts::formatCoordinateForApi`
  formatea el número a la cadena de 6 decimales que espera el
  `DecimalField` del backend (mismo algoritmo, reimplementado, que
  `popyplan-mobile/app/_utils/coords.ts`, que el panel no puede importar
  al no compartir paquete).
- **`lib/events/validation.ts`**: mensajes de validación en cliente
  copiados letra por letra del `.po` en español del backend
  (`~/Code/popyplan/locale/es/LC_MESSAGES/django.po`) para que coincidan
  si de todos modos se llega a pedir: «La actividad tiene que empezar en
  el futuro.» (`starts_at` futuro, y solo si cambió al editar — ver
  arriba), «La actividad no puede terminar antes de empezar.»
  (`ends_at`), «El aforo mínimo es de una plaza.» (`capacity`) y «Una
  actividad solo para la comunidad necesita comunidad.» (`audience:
  'community'` sin comunidad). Las traducciones eu/ca de esos cuatro
  mensajes (`messages/{eu,ca}.json::entidad.actividadForm.errors`)
  también están copiadas del propio `.po` del backend en esos dos
  idiomas, no traducidas de nuevo — el backend ya las tiene revisadas.
- **`lib/events/datetimeLocal.ts`**: conversión entre el valor de un
  `<input type="datetime-local">` (sin zona horaria, interpretado por el
  motor JS como **hora local**) y el ISO 8601 con zona que espera el
  backend — para que quien teclea vea siempre su propia hora local, sea
  cual sea la del servidor.
- **`components/entidad/ActividadesTable.tsx`**: «Nueva actividad» (solo
  `canManage`) y, por fila, «Editar» (siempre) y «Cancelar actividad»
  (solo si `status === 'scheduled'`: cancelar una actividad ya cancelada
  o celebrada no tiene sentido, aunque el backend no lo impida). Mismo
  patrón de error en el `ConfirmDialog` que el resto del panel (M6-M10 de
  la auditoría estática): el mensaje se pinta dentro, `reset()` al abrir
  y al cancelar, se cierra solo en el `onSuccess`.
- **Sin cambios en `panel/services/metrics.py` ni en las tarjetas del
  Inicio**: crear una actividad ya la cuenta el `useMetrics`/
  `useEntityEvents` de siempre en cuanto se refresca la consulta
  (invalidación de `panel-entity-events`), sin ningún endpoint ni hook
  nuevo para eso.
- **Cobertura tras esta tarea**: **99,82 %** líneas (2903/2908), 2103
  tests, 207 ficheros — cinco ficheros nuevos que cuentan para la
  medición (`hooks/useEvent.ts`, `hooks/useEventMutations.ts`,
  `lib/events/{coords,datetimeLocal,validation}.ts`), los cinco al 100 %
  de líneas; `components/entidad/{ActividadForm,ActividadesTable}.test.tsx`
  son `.tsx` de componente y no cuentan para el umbral, que sigue en
  99,7.
