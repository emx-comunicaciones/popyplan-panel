# Historial — Auditorías (2026-09, 2026-09-18, 2026-09-21, 2026-09-24)

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

## Auditoría estática de bugs (2026-09, post-Fase 6)

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
  un 401, se limita a mandar al login con el destino guardado (**en `/`,
  a dejar pasar sin sesión**: es la landing pública): la cookie de más
  que se queda en el navegador no da bucle —`/login` está fuera
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
  recién creado. **Obsoleto desde la auditoría de 2026-09-21** (ver
  «Auditoría de integración» abajo): el hook pide `?owner_org=`, que es
  una petición y no un recorrido, así que el `staleTime` se retiró; el
  tope de páginas y sus dos `kind` de error siguen.
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
  «Hooks de datos» arriba (retirado en la auditoría de 2026-09-21, que
  cambió el recorrido global por `?owner_org=`).

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
- **Refresco de sesión sin caché compartida entre runtimes** (F3): el
  single-flight y el `rotationCache` valen dentro de cada proceso. Una
  caché compartida (Redis o equivalente) cerraría también la carrera
  entre el middleware Edge y el route handler Node, y entre instancias;
  mientras no exista, la mitigación es que solo el route handler borre la
  cookie.
- **B6, del repo backend**: cada navegación rota el refresh y deja una
  fila en `OutstandingToken`/`BlacklistedToken`. Sin un
  `flushexpiredtokens` periódico, esas tablas crecen sin techo.

## Auditoría de integración app ↔ backend ↔ panel (2026-09-21)

Informes en `.superpowers/audit-2026-09-21/` (A-F) y plan de arreglos en
`PLAN-ARREGLOS.md` de esa misma carpeta. Esta sección recoge solo los
arreglos del **panel** (rama `fix/auditoria-panel`); los del backend y los
de la app viven en sus propios repos.

- **Todas las comunidades de la entidad, por `?owner_org=` (B-C1)**:
  `hooks/useEntityCommunities.ts` pide
  `GET /api/communities/?owner_org=<orgId>&page=N` en vez de recorrer el
  listado **global** página a página y filtrar en el cliente por
  `owner.id`. El backend sí admite ese filtro desde P6
  (`communities/unified_viewset.py::get_queryset`) y además atiende la
  petición en **modo privilegiado** para quien tiene `moderar` en esa
  entidad: con él llegan también las comunidades `private` de las que
  quien mira no sea miembro y las de los dos espacios de POP Familias.
  Sin él, la entidad de demo veía **1 de sus 5** comunidades (y
  `hasFamilies` de Comunicaciones/Biblioteca decía «no hay espacio de
  familias» con la comunidad de familias creada). El parámetro no está
  declarado en `docs/schema.yaml` (el `list` no lleva
  `@extend_schema(parameters=…)`), así que `npm run gen:types` nunca lo
  sacó — el lote 2 del backend lo documenta. Se mantienen `MAX_PAGES`
  (250) y los dos `kind` de error; **desaparece el `staleTime` de 5
  minutos** (F5), que solo existía para no repetir el recorrido caro: con
  una petición por montaje, los badges de `members_count` dejan además de
  quedarse stale tras aprobar o expulsar a alguien.

- **Menú de entidad por permisos reales (A-I3 y D-I8)**
  (`lib/auth/entidadMenu.ts`): `dinamizador` pierde **Personas** (la
  lista pide `ver_lista_nominal` **y** un rol de
  `panel/viewsets.py::ROLES_LISTA_PERSONAS` —titular/moderador/
  referente—, y la ficha pide `ver_ficha`, los mismos tres: la sección
  entera era un 403) y **Guardia** (`safety/viewsets.py
  ::HelpRequestViewSet.pending` acepta `es_guardia or puede(user, org,
  'moderar')`, y `'moderar'` es titular/moderador). Al revés,
  `Organization.on_call_user` admite **cualquier** `OrgMembership`
  (`entities/serializers.py::validate_on_call_user`), así que una
  `analista`, `referente` o `dinamizador` nombrada guardia recibía los
  avisos por API sin pantalla donde verlos: `entidadMenuFor(role, {
  isOnCall })` gana un segundo argumento —la única parte del menú que no
  depende solo del rol, porque en el backend tampoco— y «Guardia» entra
  en su sitio del menú. Lo calculan el layout de entidad (que ya tiene la
  ficha) y `guardia/page.tsx` con `lib/auth/organization.ts
  ::isOnCallUser(orgId, session)`, que reutiliza la
  `getServerOrganization` memoizada por petición (ninguna llamada de
  más) y devuelve `false` si la ficha no se puede leer. Un rol sin panel
  (`ver_panel`) no gana la sección por ser la guardia: el layout ya lo
  devuelve a la raíz. Actualizadas las tres audiencias de
  `messages/*.json::help.entidad.{personas,personaFicha,guardia}`, que
  nombraban al dinamizador.

- **`ReferentName` comparaba ids de dos secuencias distintas (A-I4)**
  (`components/entidad/ConfiguracionPanel.tsx`): `Reference.referent` es
  el id de la **`OrgMembership`** (`entities/models.py`:
  `ForeignKey(OrgMembership)`; `docs/schema.yaml::Reference.referent` lo
  confirma), y la tabla de Referencias lo buscaba en
  `OrgMembership.user`. En la entidad de demo eso es `referent: 190`
  contra `{id: 190, user: 11}`: la columna decía siempre «Referente sin
  nombre». Y podía decir algo peor — el nombre **de otra persona**—
  cuando el id de membresía de una coincidía con el id de cuenta de otra
  (dos secuencias de enteros del mismo rango; las membresías de todas las
  entidades comparten la suya). Ahora compara `m.id ===
  referentMembershipId` (la prop se llama así para que no vuelva a
  confundirse), con un test de la colisión.

- **La entidad ya puede nombrar a su persona de guardia (D-I8)**
  (`components/entidad/GuardiaPanel.tsx::GuardiaSettings`):
  `on_call_user` era escribible por API pero ninguna pantalla lo fijaba,
  y la pista imprimía el **id de cuenta** en crudo («Persona de guardia
  actual: 8»), contra la regla de no pintar ids de cuenta. Ahora es un
  `<select>` de `useOrgMembers` con `public_name` (mismo patrón que el
  select de referente de `AddPersonDialog`), y se guarda junto al
  teléfono en el **mismo** `PATCH` — los dos campos van por la misma
  lista blanca solo-titular (`entities/viewsets.py::update` exige
  `equipo`), así que separarlos en dos peticiones no tenía sentido.
  Vaciarla manda `on_call_user: null` (`null=True`/`SET_NULL`), no cadena
  vacía como el teléfono. El `GET .../members/` es también solo-titular,
  así que con `moderador` el 403 **no** rompe la pantalla: no se pinta el
  selector, se dice «Solo el titular puede ver y cambiar la persona de
  guardia.» y el teléfono se sigue pudiendo intentar guardar. Claves
  nuevas `entidad.guardia.{onCallLabel,onCallLoading,onCallOnlyTitular}`
  en los cuatro catálogos; `onCallHint` desaparece.

- **«Me encargo» de la red de apoyo, visible en la guardia (D-I4)**
  (`components/help/SupportResponses.tsx`, nuevo, compartido por
  `GuardiaPanel.tsx` y `components/plataforma/AyudaPendienteList.tsx`):
  `HelpRequest.support_responses` (`docs/PANEL.md` §14.4) lo sirve el
  backend desde la Fase 7 y `lib/api/types.ts::SupportResponse` ya lo
  tipaba, pero ninguna de las dos colas del panel lo pintaba (la app
  móvil sí) — la guardia llamaba a una persona sin saber que alguien de
  su red llevaba veinte minutos con ella. Cada respuesta se pinta como
  «`<public_name>`, de su red de apoyo, se está encargando ·
  `<fecha y hora>`»; con el array vacío se dice explícitamente que nadie
  se ha encargado todavía (un hueco en blanco se lee como «no hay red»,
  que es otro dato). **Nunca** contacto, y tampoco la relación
  (`parent`/`friend`/…): esa vive en `PersonSupportRow.relationship`, que
  solo ve el referente en la ficha de la persona — el serializer de este
  aviso no la manda. Claves nuevas
  `entidad.guardia.{supportResponse,supportResponsesEmpty}` (namespace
  compartido con la cola de plataforma, como ya pasaba con
  `notMember`/`referent`).

- **Actividades con selector de periodo (C-I8)**
  (`components/entidad/ActividadesTable.tsx`): el periodo estaba clavado
  a `presetPeriod("mes")` —del día 1 del mes en curso **hasta hoy**— y no
  había selector, así que las actividades **futuras** no aparecían nunca,
  ningún mes anterior se podía consultar y el día 1 de cada mes la
  sección estaba casi vacía. Arrastraba a Asistencia, que reutiliza esta
  tabla como selector de actividad: el check-in solo era alcanzable para
  actividades de este mes ya empezadas. Ahora monta el mismo
  `components/metrics/PeriodSelector.tsx` que los dashboards de métricas
  (arranca en «Este mes»); a lo que viene se llega con el rango
  personalizado, cuyo `until` puede ser futuro — ni `customPeriod` ni
  `panel/viewsets.py::_periodo` ponen tope por arriba, solo la diferencia
  de 1461 días. `asistencia/page.tsx` lo hereda sin tocar nada, porque
  monta la misma tabla.

**Fix round 1 (revisión de rama, `FIX-panel-review.md`)** — I1: el enlace
de cada aviso de la guardia a la ficha de la persona
(`GuardiaPanel.tsx::HelpRequestCard`) se pintaba siempre que
`user_display.is_member`, sin mirar si quien mira tiene la sección
Personas. Esta misma rama abre Guardia a la persona de guardia **sea cual
sea su rol** y quita Personas al `dinamizador`, así que una `analista` o
un `dinamizador` de guardia aterrizaban en el «Sin acceso» a página
completa de `personas/[userId]/page.tsx` — exactamente el patrón F1 que
el repo ya había arreglado para `referente` → Asistencia
(`canOpenAttendance`). `GuardiaPanel` recibe ahora `canOpenPersonSheet`,
que calcula `guardia/page.tsx` con `entidadMenuFor(role, { isOnCall
}).includes("personas")`; sin él, el nombre se pinta como texto, sin
`<a>` (y sin el badge «No pertenece a la entidad», que es otro caso
distinto).

En la misma ronda, los cinco menores de esa revisión: **M1**, una guardia
que ya no está en el equipo (`membership.delete()` **no** limpia
`Organization.on_call_user`, que es una FK a `User` con `SET_NULL` solo al
borrar la cuenta) dejaba el `<select>` controlado cayendo al primer
elemento —«Sin asignar», una mentira: el backend le sigue enrutando los
avisos— **y** «Guardar» reenviaba ese id, que `validate_on_call_user`
rechaza con 400, impidiendo incluso guardar solo el teléfono; ahora, con
el equipo cargado y ese id fuera de la lista, se manda `on_call_user:
null` y se pinta un `role="alert"` diciendo qué ha pasado. **M2**, el
formulario de ajustes de guardia solo se monta con rol `titular` (`PATCH
/api/organizations/{id}/` exige `equipo`, que es solo-titular), y el
resto —moderador, y la analista/referente/dinamizador que esté de
guardia— ve una tarjeta de **solo lectura** con el teléfono y quién puede
cambiarlo; se esconde, no se deshabilita, igual que `ConfiguracionPanel`
con la pestaña Equipo, y para ese camino ni se pide el equipo (sería un
403 seguro). **M3**, `help.entidad.guardia.actions` decía «ver quién está
de guardia» cuando ya se puede **elegir** (cuatro catálogos). **M4**,
`SupportResponses` formatea su fecha con `activeLanguage()`, la misma
fuente que la fecha de creación que se pinta justo encima en la misma
tarjeta. **M5**, `useCommunityInviteCode` pierde la opción `enabled` que
ningún sitio pasaba (el componente se monta condicionalmente) y su
docstring deja de describirla.

- **Código de invitación de una comunidad privada (B-I8)**
  (`hooks/useCommunityInviteCode.ts` nuevo, `COMMUNITIES.INVITE_CODE`,
  `ComunidadesPanel.tsx::InviteCode`): el panel ofrecía crear comunidades
  `private` (`NuevaComunidadDialog`) pero no enseñaba el código en
  ninguna parte, así que una privada creada desde el panel era un
  callejón sin salida — nadie podía entrar en ella. Con la comunidad
  seleccionada, `visibility === 'private'` y `canManage`, se pinta el
  código de `GET /api/communities/{id}/invite-code/`
  (`communities/unified_viewset.py::invite_code`, «Solo para gestores y
  solo en comunidades `private`») con un botón «Copiar código»
  (`navigator.clipboard`, con aviso si el navegador lo niega — el código
  queda visible y seleccionable igual). Las otras dos visibilidades ni
  montan el hook: el backend respondería 400. El endpoint contesta
  `{"error": …}` en vez de `{"detail": …}` en sus dos rechazos, que
  `lib/api/drfError.ts::detailOf` ya lee. **Fuera de alcance**: «Eliminar
  comunidad» (`DELETE /api/communities/{id}/`), que el mismo hallazgo
  pedía — es una acción destructiva con su propio diálogo y no estaba en
  el plan de arreglos de esta rama.

## Auditoría de producto y reglas de visibilidad (2026-09-24)

Recorrido del producto **ejecutándolo** (la app contra el backend real, el
panel con un navegador), no leyéndolo. Informe y traspaso completos en
`.superpowers/audit-producto-2026-09-23/` (fuera de git: está en
`.gitignore`). Lo que afecta a este repo:

- **Encuestas paginaba y el panel la trataba como array plano**
  (`hooks/useSurveys.ts`): `surveys.data.map is not a function` tumbaba la
  sección entera de cualquier entidad con encuestas. Es el fallo gemelo del
  de `reports/queue` que ya documenta este fichero, y por el mismo motivo —
  **el test mockeaba la forma de la respuesta, no la real**. El hook recorre
  ahora todas las páginas (tope + aviso, como `useEntityCommunities`) y
  `PaginatedSurveyList` queda como tipo manual en `lib/api/types.ts`.
- **El espacio de familias nace `private`**
  (`components/entidad/NuevaComunidadDialog.tsx`): al espacio de familias se
  entra porque la entidad invita, no por curiosidad. Estando `open`,
  cualquiera vinculado a una asociación se metía de un toque, y eso le
  cerraba el espacio de miembros de esa entidad sin aviso. Solo cambia el
  valor de partida del formulario cuando `space === "families"`; las tres
  visibilidades se siguen ofreciendo y `members` sigue proponiendo abierta.
- **Reglas de visibilidad del backend que este panel consume** (detalle en
  el `CLAUDE.md` de `~/Code/popyplan`): una comunidad con `owner_org` solo
  la ve quien está vinculado a alguna entidad; las actividades no entran en
  esa regla (lo decide su `audience`); y en el descubrimiento y la agenda el
  punto **mide** la distancia, mientras que recortar por cercanía lo pide
  quien manda `radius_km`.

- **Editar una actividad ya celebrada era imposible**
  (`lib/events/validation.ts::sameMinute`): el formulario comparaba
  `starts_at` con el original **por cadena** para no reenviarlo si no
  cambió, pero el valor guardado lleva segundos y un `datetime-local` solo
  rehidrata hasta el minuto, así que «siempre había cambiado» → exigía
  futuro → «Guardar» muerto con «La actividad tiene que empezar en el
  futuro». Ahora se compara por minuto, como ya hacía la app móvil. La
  nota que decía que «basta comparar el ISO reconstruido porque el
  formulario no rehidrata segundos» era justo la suposición equivocada.
- **Una actividad recién creada desaparecía de la lista**
  (`lib/metrics/period.ts::periodIncluding`): la tabla arranca en «Este
  mes», que llega hasta hoy, y toda actividad nueva es futura por
  definición. Al guardar, el periodo se amplía hasta su fecha.
- **Programas exige presupuesto y no lo dice**: `budget_cents` es
  obligatorio en el backend, así que el formulario hace bien en pedirlo,
  pero «Guardar» nace deshabilitado sin ninguna pista de qué falta.
  Anotado como deuda de UX, sin tocar.

**Lo que no es un fallo:** al entrar, la primera carga de cada Inicio
dispara varios 401 que se resuelven solos — es el refresco de sesión que ya
documenta «Diseño de sesión». Con la página asentada, todo responde 200.
