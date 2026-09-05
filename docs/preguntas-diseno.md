# Preguntas de diseño abiertas — Task W1

(Las preguntas de la tarea W2 están al final del fichero, después de la
sección 5.)

## 1. No hay refresh token real (bloqueante para el diseño de sesión previsto)

El plan preveía «access token en memoria + refresh token en cookie
`httpOnly`». Al implementar, `POST /api/auth/login/`
(`users/auth_viewsets.py::AuthViewSet.login`, backend) solo devuelve
`{key, user}`: genera un `RefreshToken.for_user(user)` pero solo usa
`refresh.access_token` y descarta el propio refresh token — no hay
`Set-Cookie`, no viaja en el cuerpo, y `docs/schema.yaml` no tiene
ninguna ruta `/api/*token/refresh*` (ni `dj-rest-auth`/`simplejwt` la
exponen aquí).

Esta tarea adapta el diseño: la cookie `pp_session` guarda el propio
access token (documentado en `lib/auth/cookie.ts`), y "refrescar" hoy
significa "confirmar contra el backend que ese access token sigue vivo"
(`GET /api/users/users/me/`), no rotarlo. Efectos:

- La sesión dura como mucho `SIMPLE_JWT.ACCESS_TOKEN_LIFETIME` (24 h
  hoy, `pop/settings.py`): pasado ese tiempo, recargar la página fuerza
  un login nuevo. No hay manera de extender la sesión sin volver a pedir
  usuario/contraseña.
- **Pregunta para el propietario / backend:** ¿se añade una ruta real de
  refresh (p. ej. `rest_framework_simplejwt.views.TokenRefreshView` bajo
  `/api/auth/token/refresh/`, o que `AuthViewSet.login` devuelva también
  `refresh` y lo blacklistee/rote como ya hace `logout`) en una tarea de
  Fase 5 posterior? Si la respuesta es sí, `lib/auth/cookie.ts` y las dos
  rutas de `app/api/session/` son los únicos ficheros que hay que tocar
  (el resto del panel ya habla con `/api/session/*`, nunca con el
  backend de auth directamente).

## 2. Menú de `dinamizador`: ¿oculta también "Informes"?

El checklist de la tarea dice «dinamizador no ve Informes de
exportación», pero las reglas explícitas de esta misma tarea dicen
«dinamizador hides Configuración, Reportes, Comunicaciones» (sin mencionar
Informes). Además, la matriz de `entities/permissions.py`
(`docs/SEGURIDAD_Y_MODERACION.md` §8) no da a `dinamizador` el permiso
`exportar_informes`.

Implementado según la regla explícita más detallada: `dinamizador` **sí**
ve la sección «Informes» en el menú (`lib/auth/entidadMenu.ts`), pero no
tendrá permiso de exportar dentro de ella cuando esa pantalla se
construya (W2+, filtrado por `exportar_informes` en el backend). Si la
intención real era ocultar también «Informes» al dinamizador, es un
cambio de una palabra en `DINAMIZADOR_HIDDEN`
(`lib/auth/entidadMenu.ts`).

## 3. Detección de entidad paraguas: el backend no expone `org_type` en `org_memberships`

`GET /api/users/users/me/` → `org_memberships[]`
(`OrgMembershipRefSerializer`, backend) trae `organization_id`,
`organization_name`, `organization_slug`, `is_verified`, `logo`, `role` —
nunca `org_type`. Solo `GET /api/organizations/{id}/` (la ficha completa)
lo tiene. Así que hoy `resolveArea` (`lib/auth/area.ts`) **nunca** puede
distinguir de verdad una entidad paraguas por esta vía: toda membresía
resuelve a `entidad`, tal y como pedía la instrucción de esta tarea
(«otherwise entidad»).

`resolveArea` ya acepta `org_type` como campo opcional en
`OrgMembershipForArea` (`lib/api/types.ts`) para el día en que el
backend lo añada al serializer — no haría falta tocar la lógica, solo el
contrato. **Pregunta:** ¿se añade `org_type` a
`OrgMembershipRefSerializer` en una tarea de panel de paraguas (W2+), o
se prefiere que el panel pida `GET /api/organizations/{id}/` de cada
membresía para saberlo (una llamada extra por entidad en el login)?

## 4. Menú de "elegir varias entidades": forma de `resolveArea`

El signature pedido en el brief es
`resolveArea(me, platformRole) -> 'plataforma' | {entidad: slug} |
{paraguas: slug} | 'sin-acceso'`, pero ese union no deja hueco para "más
de una entidad con panel", que la misma tarea pide resolver con una
página `/elegir-entidad`. Se ha añadido una quinta variante
`{kind: 'multiple-entidad', orgs: [...]}` (`lib/auth/area.ts`) — el resto
de variantes llevan `kind` también (`{kind: 'entidad', slug}` en vez de
`{entidad: slug}`) para que sea un discriminated union limpio en
TypeScript. Si se prefiere la forma literal del brief, es un cambio de
forma en `Area` y en los tres sitios que hacen `if (area.kind === ...)`.

## 5. Menú de `/plataforma`: ¿las 8 secciones para los 4 roles por igual?

`safety.PlatformRole` tiene cuatro roles (`superadmin`, `verifier`,
`moderator`, `support`) con matrices de permiso distintas (§1 de
`docs/SEGURIDAD_Y_MODERACION.md` no detalla una matriz de plataforma
como sí hace con la de entidad). Esta tarea pinta las 8 secciones del
menú igual para los cuatro roles (`lib/auth/plataformaMenu.ts`); filtrar
qué rol puede *usar* cada sección (p. ej. "Roles" solo para
`superadmin`) queda para las tareas P5-P7 que construyen esas páginas de
verdad.

# Preguntas de diseño abiertas — Task W2

## 6. Tabla «Por municipio» sin columna de asistencia %

El brief de W2 pedía que la tabla «Por municipio» del panel de paraguas
llevara nombre, código INE, eventos, personas **y asistencia %**. El
esquema fijo de `docs/PANEL.md` §1.4 (`ByPlaceRow`) solo tiene
`key`/`label`/`events`/`people`/`suppressed` — no hay una tasa de
asistencia por fila, solo la global (`attendance.rate`, en la sección
base). Implementado sin esa columna (`components/metrics/MetricsTable.tsx`);
si de verdad hace falta una asistencia por municipio/entidad, es un
cambio de contrato en `panel/services/metrics.py::_place_rows` (o como
se llame internamente) para añadir `attended`/`no_show` por fila, no
solo algo que el panel pueda inventar con los datos que ya tiene.

## 7. Menú de plataforma: el enlace «Métricas» es visible para `verifier`, que no tiene permiso

`docs/PANEL.md` §1.1: `panel-plataforma-metrics` exige
`HasPlatformRole('superadmin', 'moderator', 'support')` — **no**
`verifier`. `lib/auth/plataformaMenu.ts` (W1) pinta las 8 secciones
igual para los cuatro roles; esta tarea no lo ha tocado (la pregunta 5
de W1 ya dejaba esto para cuando la página existiera de verdad, y ahora
existe). Un `verifier` que entre en «Métricas» hoy ve un enlace que
lleva a un 403 traducido como `ErrorState` («No tienes acceso a estas
métricas.»), nunca datos con lista nominal ni una pantalla rota — pero
la experiencia sería mejor ocultando el enlace. **Pregunta:** ¿se oculta
ya el enlace «Métricas» para `verifier` en `lib/auth/plataformaMenu.ts`,
o se deja así hasta que una tarea posterior (P5-P7) reordene todo el
menú de plataforma por permisos reales?

## 8. Export de plataforma/paraguas: sin selector de `group_by=comarca|province`

`docs/PANEL.md` §2.1: el `group_by` del export admite `place` (defecto),
`comarca`, `province`, `organization` (nunca `weekday_hour`/`month`, que
se calcula aparte siempre). El panel de plataforma expone un selector
de solo dos opciones (Territorio=`place`, Entidad=`organization`,
`components/metrics/PlataformaMetricsDashboard.tsx`) que también decide
el `group_by` de la exportación (`ExportPanel`); `comarca`/`province`
quedan sin UI en esta tarea. El panel de paraguas exporta siempre con
el `group_by` por defecto del backend (`place`), sin selector. Si se
quiere ofrecer comarca/provincia desde el panel, es un cambio pequeño en
`GROUP_BY_OPTIONS` de `PlataformaMetricsDashboard.tsx` (y decidir si el
panel de paraguas necesita el mismo selector para exportar por
comarca/provincia).

# Preguntas de diseño abiertas — Task W3

## 9. Ficha de persona: el brief dice 403 para el referente sin asignación, el contrato real da 404

El brief de W3 («403 → estado "Sin acceso" para referente en ficha
ajena») no coincide con `docs/PANEL.md` §3.3 ni con el código real
(`panel/viewsets.py::EntidadPersonView.get`): un `referente` sin
`Reference` hacia esa persona recibe **404** («No existe esa persona en
esta entidad»), a propósito — no confirma si la persona existe en la
entidad a quien no tiene por qué verla. Implementado según el contrato
real: `usePerson` traduce tanto 403 como 404 a
`PersonError('sin_acceso', …)`, así que la página pinta el estado «Sin
acceso» pedido por el brief sea cual sea el código HTTP real. **Sin
pregunta pendiente de decisión** (el contrato manda), solo se deja
constancia de la discrepancia entre el brief y `docs/PANEL.md` por si
otro brief de esta fase repite la misma cifra equivocada.

## 10. `docs/schema.yaml` con tres rutas mal anotadas (verificado contra el código, no solo el esquema)

`GET /api/panel/entidad/{id}/people/` se documenta como array plano
(debería ser `Paginated*List`); `GET /api/events/{id}/attendees/` se
documenta como `PaginatedAttendeeList` (debería ser array plano);
`POST /api/events/{id}/attendance/` y `POST /api/events/{id}/checkin/`
se documentan con `EventDetail` como respuesta (deberían ser
`{user_id, status}` y `{status, already}`). Los cuatro casos se
verificaron leyendo el código real de `panel/viewsets.py` y
`events/viewsets.py`, no solo `docs/schema.yaml`. Implementado según el
comportamiento real (tipos manuales en `lib/api/types.ts`,
documentados uno a uno). **Pregunta para el equipo backend:** ¿merece la
pena una tarea de limpieza que corrija los `@extend_schema` de estas
cuatro vistas (envolver `people` en el paginador real, quitar el
envoltorio de paginación de `attendees`, declarar `responses=` en
`attendance`/`checkin`) para que `docs/schema.yaml` dejen de mentir y
`npm run gen:types` genere los tipos correctos sin que el panel tenga
que mantenerlos a mano?

## 11. `StatCard`/`formatCount` con supresión a nivel de sección, no de celda (hallazgo en código ya existente de W2)

Al escribir las tarjetas de métricas del mes del Inicio de entidad se
detectó que `ParaguasMetricsDashboard.tsx`/`PlataformaMetricsDashboard.tsx`
(W2) pasan el `suppressed` de **toda la sección** (`people.suppressed`,
p. ej.) a `formatCount` para **cada** campo de esa sección
(`active`/`new`/`repeating`), en vez del `suppressed` real de cada
celda. `docs/PANEL.md` §1.5 es explícito en que la supresión se aplica
«de forma independiente a cada celda» y da un ejemplo donde
`attendance.attended` (visible, valor real) convive con
`attendance.registered`/`no_show` suprimidos en la **misma** respuesta
— con el patrón actual, si alguna vez llega esa combinación real desde
el backend, `attended` se pintaría como `<5` aunque su valor no esté
suprimido, porque el JSON solo trae un `suppressed` por sección (no uno
por celda: la única señal fiable de si una celda concreta está
suprimida es que su `value` sea `null`). Esta tarea (W3) replica el
mismo patrón en `EntityHomeDashboard.tsx` por consistencia con el código
ya enviado, y no lo corrige (es un cambio en componentes de W2, fuera
del alcance de esta tarea). **Pregunta:** ¿se corrige en una tarea de
limpieza aparte (cambiar todos los `formatCount(value, section.suppressed)`
por `formatCount(value, value === null)`, que es equivalente y correcto
salvo para `attendance.rate`, cuyo `null` también puede significar
«denominador cero» sin supresión — un caso que el contrato actual no
permite distinguir desde el JSON) o se deja así porque en la práctica
(fixtures de test, escenarios reales) casi nunca se da la combinación
exacta que lo expondría?

## 12. Personas/Actividades sin selector de periodo

El brief no pedía un selector de periodo para `personas`/`actividades`
(a diferencia de la vista del financiador, W2), así que ambas páginas
fijan el periodo al mes en curso (`presetPeriod('mes')`) sin UI para
cambiarlo. Afecta a los contadores `events_period`/`attended_period` de
la lista de personas y al criterio de «persona de la entidad» por
asistencia (`docs/PANEL.md` §3.1) — alguien que solo participó fuera del
mes en curso no aparece. **Pregunta:** ¿hace falta un selector de
periodo en estas dos páginas (como en la vista del financiador), o el
mes en curso es la ventana operativa que de verdad usa el equipo de una
asociación día a día?

## 13. «Asignar referente»: id numérico a mano, sin selector de personas con rol `referente`

El endpoint que lista el equipo de la entidad
(`GET /api/organizations/{id}/members/`, solo `titular`, §8 de
`SEGURIDAD_Y_MODERACION.md`) no estaba en el contrato que esta tarea
tenía que consumir, así que el formulario «Asignar referente»
(`PersonSheet.tsx`) pide el id numérico de la persona referente a mano
en vez de ofrecer un desplegable con los miembros que ya tienen ese rol
en la entidad. Funciona (el backend valida que `referent_user` tenga
rol `referente` en la entidad, 400 si no), pero es incómodo: quien
gestiona el panel tendría que saber de memoria el id de cada referente.
**Pregunta:** ¿se añade `ORGANIZATIONS.MEMBERS` al contrato de una tarea
posterior para poder ofrecer un selector de verdad?

# Preguntas de diseño abiertas — Task W4a

## 14. Comunidades de la entidad: no existe `GET /api/communities/?owner_org=` (hueco de backend, no solo de contrato)

El brief pedía «lista de las comunidades de la entidad» consumiendo «la
API existente de comunidades», pero `communities/unified_viewset.py::
CommunityViewSet.get_queryset` no admite filtrar por `owner_org` (solo
`place`/`category`/`search`, sin `filterset_fields` de verdad pese a que
`DjangoFilterBackend` esté en `DEFAULT_FILTER_BACKENDS` — sin
`filterset_fields`/`filterset_class` declarados, el backend no filtra
nada). `hooks/useEntityCommunities.ts` recorre todas las páginas visibles
de `GET /api/communities/` y filtra en el cliente por
`owner.type === 'organization' && owner.id === orgId` — funciona para
demos pequeñas, pero es O(comunidades totales de la plataforma), no
O(comunidades de la entidad).

Más grave: `communities/services/visibility.py::_visibles_para` excluye
las comunidades `private` de quien no sea ya miembro activo, **incluido
el propio `titular`/`moderador` de la entidad propietaria** si no está
personalmente dentro. Una comunidad privada de la entidad de la que
quien mira no sea miembro simplemente no aparece en «Comunidades» — ni
como fila, ni como opción para ver sus solicitudes pendientes. No hay
manera de detectarlo desde el panel (no hay ni un `count` total por
separado).

**Pregunta para backend:** ¿tiene sentido una ruta propia (p. ej.
`GET /api/organizations/{id}/communities/`, o un `?owner_org=` real en
`CommunityViewSet` que además ignore `_visibles_para` para quien
`puede(user, org, 'moderar')`) para que el panel de entidad vea de
verdad **todas** sus comunidades, privadas incluidas?

## 15. Equipo, referencias y guardia: solo ids numéricos, sin buscador de personas

`GET /api/organizations/{id}/members/` (equipo) y
`GET/POST /api/organizations/{id}/references/` (referencias) devuelven y
esperan ids de usuario desnudos (`OrgMembership.user`,
`ReferenceRequest.user`/`referent_user`), sin nombre ni forma de
buscarlos: `GET /api/users/users/` (`users/unified_viewset.py::
list_users`) es `permission_classes=[permissions.IsAdminUser]`, así que
ni siquiera un `titular` puede usarlo para localizar el id de la persona
que quiere dar de alta. Fijar la guardia (`on_call_user` en
`PATCH /api/organizations/{id}/`) tiene el mismo problema. Implementado
tal cual (formularios con un campo numérico «id de usuario»,
`components/entidad/ConfiguracionPanel.tsx`/`GuardiaPanel.tsx`) —
funciona pero es incómodo de verdad para uso diario (ya apuntado en la
pregunta 13 de W3 para «Asignar referente», que sigue sin resolverse
aquí). **Pregunta:** ¿se abre un endpoint de búsqueda de personas
accesible a `titular`/`moderador` de su propia entidad (p. ej.
`GET /api/organizations/{id}/members/search/?q=` limitado a quienes ya
tienen alguna relación con la entidad, o ampliar el permiso de
`list_users` para ese caso concreto)?

## 16. Logo de la entidad: el contrato de escritura espera fichero, no URL

`OrganizationRequest.logo` es `Format: binary` (multipart), no una URL
de texto — subir un logo nuevo exige un `<input type="file">` con
`FormData`, un `Content-Type` distinto del JSON que usa siempre
`apiFetch` (`lib/api/client.ts`), y probablemente su propio manejo del
401 (un solo intento, sin el reintento-con-refresco que si tiene
`apiFetch`). Configuración (`ConfiguracionPanel.tsx`) hoy solo **muestra**
el logo actual (si lo hay) y explica que subir uno nuevo no está
disponible todavía — no se ha construido el flujo de subida por el
volumen de trabajo ya cubierto en esta tarea. **Pregunta:** ¿se prioriza
esto para W4b, o se deja para una tarea de «marca blanca» más amplia
(Fase 6 ya prevé tematización completa)?

## 17. `post_event_survey_enabled` no está en la lista blanca de `PATCH /api/organizations/{id}/`

El campo existe en `entities/models.py::Organization` y se usa de verdad
(`panel/services/surveys.py`), pero ni `OrganizationSerializer` ni
`OrganizationRequest` (`docs/schema.yaml`) lo exponen — la lista blanca
real es `description, contact_email, contact_phone, help_phone, website,
logo, primary_color, secondary_color, on_call_user`. Se omite en
`ConfiguracionPanel.tsx` tal y como permitía el brief («skip» si el campo
no existe en el esquema). **Pregunta:** ¿se añade a la lista blanca en
una tarea de backend, ya que Encuestas (W4b) necesitará un interruptor
para activar/desactivar la encuesta post-actividad automática?

## 18. «Informes» de entidad: la página no existe (404 para quien la vea en el menú)

`lib/auth/entidadMenu.ts` incluye «informes» para
`titular`/`moderador`/`dinamizador`/`analista` (este último la ve como
**única** sección operativa, según el checklist del brief: «analista solo
ve Informes y métricas»), pero no existe
`app/entidad/[slug]/informes/page.tsx` — ni esta tarea ni ninguna
anterior (W1-W3) la construyó; la «vista del financiador» de W2 solo
cubre `/paraguas` y `/plataforma`. Hoy cualquiera de esos cuatro roles
que pinche en «Informes» del menú de entidad recibe un 404 real de
Next.js. Fuera del alcance explícito de esta tarea (el brief de W4
enumera Comunidades/Comunicaciones/Encuestas/Recursos/Familias/
Reportes/Guardia/Configuración, nunca Informes), pero se deja constancia
porque es el gap más visible para `analista`, el rol que menos secciones
tiene. **Pregunta:** ¿en qué tarea se construye `entidad/[slug]/informes`
(reutilizando `components/metrics/*` de W2, con `METRICS.ENTIDAD`/
`EXPORT.ENTIDAD`, que ya existen en `lib/api/endpoints.ts` sin consumir
desde ninguna página de entidad)?

## 19. Secciones W4b ocultas para `dinamizador`: Encuestas/Recursos/Familias dejan de vérsele

Antes de esta tarea, `dinamizador` veía Encuestas/Recursos/Familias en su
menú (solo Configuración/Reportes/Comunicaciones estaban en
`DINAMIZADOR_HIDDEN`). Como sus páginas reales llegan en W4b, esta tarea
las oculta también para `dinamizador` (`PENDING_SECTIONS` en
`lib/auth/entidadMenu.ts`) para que no le lleven a un 404 — mismo criterio
que ya aplicaba a `analista`/`referente`, que nunca las tuvieron. Es un
cambio de comportamiento temporal: cuando W4b construya esas páginas de
verdad, habrá que sacarlas de `DINAMIZADOR_HIDDEN` si el rol debe
recuperarlas (la instrucción de esta tarea no fija qué verá `dinamizador`
en Encuestas/Recursos/Familias una vez existan, solo qué ve mientras no
existen). **Pregunta:** ¿`dinamizador` debe recuperar esas tres secciones
en W4b, o se quedan fuera de su matriz de forma permanente?

**Resuelta en W4b (2026-09-05, decisión tomada sin bloquear la tarea):**
Encuestas y Recursos ya tienen página real en esta tarea, así que
`dinamizador` recupera ambas en su menú — la matriz original documentada
en `lib/auth/entidadMenu.ts` («todo salvo Configuración, Reportes y
Comunicaciones») nunca las excluía; solo el parche temporal de W4a lo
hacía para no dar 404. Comunicaciones sigue oculta para `dinamizador`
porque esa matriz original sí la excluye de forma explícita, y coincide
con el contrato (`POST` solo admite `titular`/`moderador`). Familias
sigue oculta (todavía sin página real, llega con P6).

## 20. Comunicaciones: sin vista previa del número de destinatarios antes de enviar

`docs/PANEL.md` §5 no ofrece un endpoint para calcular cuánta gente
recibiría un anuncio antes de mandarlo (el `recipients_count` solo llega
en la respuesta del `POST`, ya enviado). El diálogo de confirmación
(`ComunicacionesPanel.tsx`) describe la audiencia elegida en texto
(«¿Enviar esta comunicación a: Todos los miembros?») en vez de un
recuento, y el recuento real se muestra recién after el envío. **Pregunta:**
¿merece la pena un endpoint de vista previa (`GET .../announcements/preview/
?audience=...` o similar) para que quien redacta sepa antes de confirmar
a cuánta gente llega, sobre todo en la audiencia «Todos los miembros» de
una entidad grande?

## 21. Encuestas periódicas: el formulario del panel no ofrece dirigir a una comunidad

`docs/PANEL.md` §6.2 admite un `community` opcional en
`POST .../surveys/` (sin él, la encuesta es de toda la entidad). El brief
de W4b solo pedía título, fechas y preguntas para el formulario de
creación, así que `EncuestasPanel.tsx` no ofrece elegir una comunidad
(a diferencia de Comunicaciones, que sí ofrece «Una comunidad» porque el
brief lo pedía explícitamente para esa sección). **Pregunta:** ¿se añade
un selector de comunidad al formulario de encuestas, igual que en
Comunicaciones, o se deja fuera a propósito para simplificar (toda
encuesta periódica es siempre de toda la entidad)?
