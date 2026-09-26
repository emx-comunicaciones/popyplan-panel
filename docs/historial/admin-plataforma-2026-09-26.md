# Historial — Admin de plataforma (bloques 1-3, 2026-09-26)

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

## Admin de plataforma: usuarios y bloqueos (bloque 1, 2026-09-26)

Spec: `docs/superpowers/specs/2026-09-26-admin-plataforma-design.md`
(portar el admin antiguo `~/Code/admin-popylop` al panel). Solo panel,
sin cambios de backend. Dos secciones nuevas del menú de plataforma,
**solo `superadmin`** (`lib/auth/plataformaMenu.ts`: todo lo de Usuarios
es `IsAdminUser`/`is_staff`, que hoy solo tiene `superadmin`; Bloqueos
admitiría `moderator` en el backend, pero elegir la cuenta pasa por el
buscador `is_staff`, así que sin él no tendría puerta de entrada). El
menú pasa de 9 a **11** secciones.

- **`/plataforma/usuarios`** (`UsuariosTable`, `hooks/usePlatformUsers.ts`):
  `GET /api/users/users/?ordering=-created_at&page=&search=&is_active=&is_verified=`
  (`users/unified_viewset.py::list_users`; `PAGE_SIZE` fijo de 20,
  `?page_size=` no hace nada; sin `ordering` el queryset no tiene orden).
  Columnas nombre (enlace a la ficha), correo, usuario, alta, estado +
  verificación y rol de plataforma — este último de **una** llamada a
  `GET /api/safety/platform-roles/`, nunca una por fila. «Nueva cuenta»
  (`NuevaCuentaDialog`) → `POST /api/auth/admin-register/` y abre la
  ficha; no ofrece `is_staff`/`is_superuser` a propósito (el acceso a la
  plataforma se da con un rol en Roles, que se audita).
- **`/plataforma/usuarios/[id]`** (`UsuarioDetail`, `hooks/usePlatformUser.ts`):
  `notFound()` con id no numérico. Desactivar/Reactivar (`PATCH
  /api/users/{id}/ {is_active}`), Borrar cuenta (`DELETE`, borrado
  **real**, `user.delete()`, no el `soft_delete` de la baja propia; vuelve
  al listado) y «Enviar restablecimiento de contraseña» (`POST
  /api/auth/password/reset/ {email}`, la ruta pública: no hay una de
  staff; comparte el límite `ip:<ip>:auth` del login, 429 →
  `demasiados_intentos`). Todas con `ConfirmDialog` y el error dentro,
  salvo el restablecimiento (aviso `role="status"`). Ni desactivar ni
  borrar sobre la propia cuenta. Nunca teléfono, fecha de nacimiento,
  biografía, documentos ni notas.
- **`/plataforma/bloqueos`** (`BloqueosPanel`, `hooks/useBlocksAdmin.ts`):
  **no hay listado global** — `GET /api/safety/blocks/admin/?user=<id>`
  exige la cuenta (400 sin ella) y devuelve los bloqueos hechos por ella
  o contra ella. Se elige con el buscador de Roles (`useUserSearch`, con
  retardo) o llega por `?user=` (+ `?email=`) desde la ficha. Revocar
  (`DELETE /api/safety/blocks/{id}/admin/ {reason}`) pide motivo
  obligatorio (≤300, queda en Auditoría como `block.revoked_by_staff`),
  validado también en el cliente.

**El estado de una cuenta no viaja en ninguna respuesta** — el hallazgo
que condiciona todo el diseño. `list_users` y `admin_register` serializan
con `MeSerializer`, que no lleva `is_active` (ni `is_staff`), y
`GET /api/users/{id}/` es el **perfil público** (`PublicProfileSerializer`:
alias, foto, municipio, nivel), no la cuenta, con 404 para una suspendida
(`is_blocked`) o borrada. Ninguna ruta localiza una cuenta por id con sus
datos de admin. Por eso:
- el listado solo pinta «Activa»/«Desactivada» cuando el filtro «Estado»
  lo fija (`knownActive`), con una pista visible cuando no;
- la ficha localiza la cuenta **por correo**, que viaja en el enlace del
  listado (`/plataforma/usuarios/{id}?email=…`), con dos búsquedas: la
  normal y la misma con `?is_active=false` (si sale ahí, está
  desactivada). Sin `?email=` (URL a mano) la ficha lo dice y solo
  enseña el perfil público y «Borrar». El correo en la URL es un
  trade-off asumido (`Referrer-Policy` ya lo corta en peticiones de otro
  origen); el arreglo de verdad es del backend: una ficha de cuenta para
  staff con `is_active`, o `is_active` en `MeSerializer` para staff.

**Mismatches esquema/código** (documentados en `lib/api/types.ts` junto a
`PlatformAccount`/`PlatformPublicProfile`/`BlockAdmin`, tipos manuales,
**sin** regenerar `types.generated.ts`): listado y alta devuelven
`MeSerializer`, no `UserListResponse`/`RegistrationResponse`;
`verification_level` es entero (el esquema dice `string`) y
`verification_pending_review` booleano; `photo`/`place` pueden ser
`null`; `blocks/admin/` es un **array plano**, no la
`PaginatedBlockAdminList` del esquema; `BlockAdminSerializer` nombra a
las personas por **nombre de usuario** (no trae alias público), así que
la tabla de bloqueos pinta usernames. Los rechazos de `UserViewSet` son
`{"error": …}`, que `detailOf` ya lee.

**Verificado contra el backend sembrado** (Playwright sobre `next start`,
no `next dev`: los ficheros que escribe el MCP de Playwright en la raíz
del repo disparan un bucle de Fast Refresh que rompe la navegación):
listado de 228 cuentas, ficha de `panel-demo-…-p02`, desactivar y
reactivar, alta + restablecimiento + borrado de una cuenta de prueba, y
revocar un bloqueo real p01→p02.

**Pendientes, del backend**: la ficha de cuenta para staff (arriba); un
listado global de bloqueos; alias público en `BlockAdminSerializer`. i18n
`eu`/`ca` pendiente de revisión nativa (`docs/i18n/PENDIENTES.md`).

## Admin de plataforma: búsqueda del tesoro (bloque 2, 2026-09-26)

Mismo spec que los bloques 1 y 3. Contrato del backend en
`~/Code/popyplan/docs/PANEL.md` §16 (`treasure_hunt/unified_viewset.py`,
reconectado en `ad2ce56`). Una sección nueva del menú de plataforma,
**Búsqueda del tesoro** (`/plataforma/busca-del-tesoro`, clave de menú
`busca-del-tesoro`), **solo `superadmin`**: el backend exige `is_staff`
**o** `PlatformRole` superadmin (`treasure_hunt/permissions.py
::es_gestor_de_juegos`) y cualquier otro rol de plataforma recibe 403. El
menú pasa de 17 a **18** secciones. Tipos regenerados (`npm run
gen:types` contra el `docs/schema.yaml` final del backend); lecturas como
alias del generado (`TreasureGame`, `TreasureGameDetail`, `TreasureStep`,
`TreasurePrizeTier`, `TreasureParticipant`, `TreasureRankingRow`,
`TreasureCompletion`), escrituras a mano con el motivo al lado
(`lib/api/types.ts`, bloque «Búsqueda del tesoro»).

- **Listado** (`TesoroJuegosTable`, `hooks/useTreasureHunt.ts`): `GET
  /api/treasure-hunt/` — **array plano** (el viewset no pagina nada),
  borradores incluidos para quien administra. Nombre (enlace a la
  ficha), estado, inicio, participantes (`N de M` con aforo), pruebas y
  destacado. «Nuevo juego» en `Dialog` (`TesoroJuegoForm`) → `POST`
  (nace `draft`, `event_id: null`) y abre la ficha; «Borrar» con
  `ConfirmDialog` (borra también la actividad publicada).
- **Formulario** (`TesoroJuegoForm`, compartido por el alta y la pestaña
  Datos): nombre, descripción, ciudad, premio, inicio
  (`datetime-local`), duración, máximo de participantes (vacío = sin
  límite, es también el aforo de la actividad), destacado e imagen
  (multipart solo si la hay, `buildGamePayload`; `png`/`jpg`/`webp` hasta
  5 MB, `lib/treasureHunt/validation.ts::validateGameImage`). **Sin pago**
  (`is_paid` solo admite `false`; el panel ni lo manda) y **sin elegir
  modo**: esta versión de la app es solo individual, el alta manda
  `game_mode: "individual"` (el modelo nace `teams`) y la edición no lo
  toca (un juego heredado por equipos lo avisa). `start_time` solo viaja
  si cambió **por minuto** (`sameMinute`, la lección de Actividades): el
  backend lo exige futuro solo cuando cambia.
- **Ficha** (`/plataforma/busca-del-tesoro/[id]`, `notFound()` si el id no
  es UUID; `TesoroJuegoDetail`), seis pestañas con el selector de botones
  + `aria-pressed` de `EntidadDetail`, cada una su componente en
  `components/plataforma/tesoro/` y montada solo cuando se ve:
  **Datos** (resumen, un botón de ciclo de vida según estado —Abrir
  inscripciones / Empezar el juego / Terminar el juego— con
  `ConfirmDialog` y el error dentro; «Empezar» deshabilitado sin pruebas;
  la actividad enlazada con `useEvent` cuando hay `event_id`, o la
  explicación de que un borrador no se publica; y la edición),
  **Pruebas** (CRUD ordenado; `answer` exige la respuesta correcta —solo
  de escritura: al editar, vacío = conservar la guardada—, `location`
  pide latitud/longitud en dos campos y radio en metros, `photo`/
  `social` avisan de la revisión a mano), **Premios** (tramos por
  posición con la validación de solape del backend replicada en el
  cliente, `validatePrizeTier`), **Participantes** (filtro por estado;
  aprobar directo, rechazar con confirmación porque quien es rechazada no
  puede volver a unirse; solo con el juego en `draft`/`open`),
  **Validaciones** (envíos `photo`/`social` pendientes; aprobar con puntos
  opcionales, rechazar —borra el envío— con confirmación; la foto con
  `next/image` solo si `isAllowedImageSrc`, si no un enlace) y **Ranking**
  (solo lectura).
- **Caché**: claves `panel-treasure-*` con `String(gameId)` (el id es un
  UUID, pero se normaliza igual). Toda mutación invalida lo que cambia
  (el listado enseña estado, pruebas y participantes). El `PATCH` del
  juego responde `GameDetail` y se escribe en la caché antes de
  invalidar, y el formulario de Datos se remonta con una `key` derivada
  de sus valores: un contador subido en el `onSuccess` remontaba **antes**
  de que la caché notificara el detalle nuevo y dejaba los valores viejos
  (lo encontró el test de la ficha).

**Mismatches esquema/código** (en `lib/api/types.ts`): `image` es un
`File` en multipart (el esquema dice `string`); `correct_answer` es solo
de escritura (no está en `GameStep`); `latitude`/`longitude` se escriben
como cadena `DecimalField` y se leen como número; la respuesta de
`completions/{id}/validate/` es `{type: object}` en el esquema; el
ranking se llama `Ranking`. Y uno de comportamiento, no de tipos:
`order` es `unique_together` con el juego pero el serializer no incluye
`game`, así que un orden repetido da un **500**, no un 400 — el panel
propone el siguiente libre y rechaza uno repetido antes de mandar nada
(`validateStep`).

**Verificado contra el backend sembrado** (`next start` en el puerto
3400, superadmin `plataforma@test.com`): alta de **«Búsqueda del tesoro
de prueba»** (Donostia, 17-oct-2026 11:00, aforo 40), dos pruebas (una de
respuesta y una de ubicación a 80 m del Ayuntamiento), un tramo de
premio «Podio» (1.º-3.º), abrir inscripciones —la actividad espejo se
pinta desde `GET /api/events/{event_id}/`, «Programada»— y editar
(destacado) sin reenviar la fecha. Ese juego **se queda en la demo**,
abierto; no se empezó ni se terminó.

**Pendientes, del backend**: validar `order` repetido con un 400;
auditar las acciones de administración del juego. i18n `eu`/`ca`
pendiente de revisión nativa (`docs/i18n/PENDIENTES.md`).

## Admin de plataforma: el resto del admin antiguo (bloque 3, 2026-09-26)

Mismo spec que el bloque 1. Seis secciones nuevas del menú de plataforma,
**solo `superadmin`**: todas sus rutas dan el acceso amplio por
`is_staff` (`IsAdminUser` o un `user.is_staff` en el código), **nunca por
`PlatformRole`** — un `superadmin` sin `is_staff` no vería nada. El menú
pasa de 11 a **17** secciones (Comunidades y Actividades tras Usuarios;
Reseñas, Chats y Notificaciones tras Bloqueos; Nomencladores al final).
Endpoints en `lib/api/endpoints.ts::{COMMUNITY_POSTS,PLATFORM_EVENTS,
REVIEWS,ADMIN_CHATS,NOTIFICATIONS,CATALOGS}` (más `COMMUNITIES`/`EVENTS`
de siempre); tipos manuales acotados en `lib/api/types.ts` (bloque
«Admin de plataforma, bloque 3»), sin regenerar `types.generated.ts`.
**Nada de lo que se hace en estas seis pantallas queda en `AuditLog`**:
el backend no audita ninguna de estas rutas (ver pendientes).

- **Comunidades** (`/plataforma/comunidades` → `ComunidadesPlataformaTable`,
  `/[id]` → `ComunidadPlataformaDetail`, `hooks/usePlatformCommunities.ts`):
  `GET /api/communities/?search=&page=` — a staff le sirve **todas**
  (privadas, de entidad, de los dos espacios e inactivas), salvo las de
  entidades que esa cuenta haya ocultado a título personal
  (`hidden_org_ids_for`); la pantalla lo dice. La fila no trae
  `is_active`: solo la ficha. Sin filtro de categoría (`?category=` es un
  `icontains` sobre el nombre). Ficha (`notFound()` con id no UUID): datos,
  Desactivar/Reactivar (`PATCH {is_active}`) y Borrar comunidad (`DELETE`,
  borrado real, también su chat), las dos con `ConfirmDialog`; miembros y
  solicitudes reutilizando la gestión de la entidad
  (`ComunidadesPanel.tsx::CommunityMembersSection`, exportada sin cambiar
  su comportamiento — staff pasa `can_manage`); publicaciones de
  `GET /api/community-posts/?community=&is_active=&page=` con
  Todas/Visibles/Ocultas, Ocultar/Mostrar (`PATCH {is_active}`, sin
  confirmación: es reversible) y Borrar (confirmación); enlace «Ver sus
  actividades» → `/plataforma/actividades?community=<id>`.
- **Actividades** (`/plataforma/actividades` →
  `ActividadesPlataformaTable`, `hooks/usePlatformEvents.ts`): **no hay
  listado global en el backend**. Dos fuentes: la **agenda**
  (`GET /api/events/agenda/?from=&to=&page=`, solo `scheduled` desde hoy,
  audiencia abierta o de entidades de las que la cuenta es miembro, sin
  atajo para staff — pista visible) y **por comunidad**
  (`GET /api/events/?community=`, todas las de esa comunidad, pasadas y
  canceladas incluidas), elegida con un buscador con retardo o por
  `?community=` desde la ficha de comunidad. «Ver» abre un `Dialog` con
  `useEvent`; «Cancelar actividad» (`POST .../cancel/`,
  `Event.is_organizer` lo concede a staff) solo con `status ===
  'scheduled'`, porque el backend deja cancelar dos veces y vuelve a
  avisar a la gente.
- **Reseñas** (`/plataforma/resenas` → `ResenasTable`,
  `hooks/useReviewsAdmin.ts`): `GET /api/reviews/?page=` (staff ve todas;
  el esquema la envuelve dos veces) y Borrar (`DELETE` → **200**
  `{message}`, no el 204 del esquema; el 403 trae `{error}`). La reseña
  solo trae el id de la actividad, así que no hay columna de título.
- **Chats** (`/plataforma/chats` → `ChatsTable`, `/[id]` →
  `ChatConversation`, `hooks/useAdminChats.ts`): `GET /api/admin/chats/
  ?chat_type=&search=&page=` (`search` solo mira el nombre de la sala; una
  sala sin nombre se etiqueta con los alias de sus participantes; el
  origen —actividad/comunidad/búsqueda del tesoro— traducido, con
  reserva al valor crudo). `last_message` no se pinta: en el listado
  llega **siempre `null`** (bug del backend, el serializer espera una
  anotación que esa vista no añade). La conversación (`notFound()` con id
  no UUID) pinta la sala, los mensajes (`GET .../messages/`, **array
  plano**; el esquema dice `ChatRoom`) y un formulario para responder
  (`POST {content}` → 201; su 400 es `{"content": "…"}` con una cadena,
  que `detailOf` no lee: el hook tiene un respaldo local). **Aviso fijo
  arriba**: acceso de soporte; lo que respondas sale con **tu propia
  cuenta y alias**, no como «Popyplan»; no llega en directo a pantallas
  abiertas (no hay emisión por WebSocket) y el aviso push solo sale si la
  conversación está aceptada; y **el backend no registra ni la lectura ni
  la respuesta** en Auditoría. Los participantes que la cuenta de staff
  tenga bloqueados (en cualquier sentido) no salen, y la pantalla lo dice.
- **Notificaciones** (`/plataforma/notificaciones` →
  `NotificacionesPanel`, `hooks/useAdminNotifications.ts`), dos pestañas:
  **Enviar** (`POST /api/notifications/send/`, a una persona elegida con
  `useUserSearch` o a todas, siempre con `ConfirmDialog`; «a todas» avisa
  de que incluye al personal y no se puede retirar; 201 `{recipients}` →
  «Enviada a N persona(s)», 202 sin `recipients` → «Envío masivo en
  cola»; estos envíos **nunca** usan plantillas) y **Plantillas**
  (`/api/notification-templates/` CRUD, paginado). Una plantilla solo
  cambia las notificaciones que genera el propio sistema de su tipo, gana
  la **activa más antigua** si hay varias, y su texto es un msgid en
  inglés con `{marcadores}` que el servidor traduce con sus `.po`.
  **Decisión**: una plantilla nueva nace **inactiva** (el backend la
  crearía activa por defecto) — activa, cambia al instante el texto de
  todas las notificaciones de ese tipo, y eso tiene que ser un paso
  consciente.
- **Nomencladores** (`/plataforma/nomencladores` → `NomencladoresPanel`,
  `hooks/useCatalogs.ts::CATALOG_CONFIG`): un `<select>` con los siete
  catálogos vivos (idiomas, categorías de aficiones, aficiones,
  categorías y subcategorías de comunidades, categorías y subcategorías
  de actividades) y, por catálogo, tabla + alta/edición en `Dialog` +
  borrado con `ConfirmDialog` que avisa de las cascadas. Tres formas de
  listado que el hook normaliza: array plano (`/api/catalogs/*` y
  subcategorías de comunidad), paginación estándar (categorías de
  comunidad, recorridas con tope) y `{results, count}` sin paginar
  (categorías y subcategorías de actividad). Ids enteros y UUID mezclados;
  en subcategorías de actividad `category` es de solo escritura y se lee
  de `category_id` (cadena de un entero, aunque el esquema diga UUID). La
  imagen de las categorías de comunidad no se sube desde el panel (el
  `PATCH` sin `image` conserva la que haya). Staff ve también las filas
  inactivas. **Un 500 al escribir se traduce a `conflicto_servidor`**:
  DRF 3.14 no valida los `UniqueConstraint(category, name)` ni convierte
  `ProtectedError` en 400 — pasa al borrar una categoría de aficiones que
  aún tiene aficiones o al repetir un nombre de subcategoría.

**Verificado contra el backend sembrado** (Playwright sobre `next start`
en el puerto 3300): listado de 45 comunidades con privadas y de
familias, ficha de «Running Kontxa» con miembros y publicaciones,
ocultar/mostrar una publicación y desactivar/reactivar la comunidad;
actividades por comunidad (4, pasadas incluidas) y agenda, detalle en
diálogo; reseñas; chats y respuesta de soporte en una sala de prueba;
enviar una notificación a la propia cuenta y alta/borrado de una
plantilla; los siete nomencladores cargando (13, 10, 39, 11, 85, 8 y 54
filas) y alta/edición/borrado de una subcategoría de actividad. No se
canceló ninguna actividad ni se borró ninguna reseña o comunidad de la
demo (avisarían a gente o destruirían datos sembrados); esos caminos
quedan cubiertos por los tests.

**Pendientes, del backend**: auditar todas estas acciones (desactivar o
borrar comunidades, ocultar o borrar publicaciones, acciones sobre
miembros, borrar reseñas, cancelar actividades, envío masivo de
notificaciones y, sobre todo, **la lectura y la respuesta de soporte en
chats**, que es un hueco de privacidad); una identidad de remitente
«Popyplan» para el soporte en chats y emisión por WebSocket de su
mensaje; arreglar `last_message` del listado de chats de admin; un
listado global de actividades para staff; impedir cancelar dos veces
una actividad; y convertir los 500 de unicidad/`ProtectedError` de los
catálogos en 400/409. i18n `eu`/`ca` pendiente de revisión nativa
(`docs/i18n/PENDIENTES.md`).
