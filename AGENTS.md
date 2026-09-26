# CLAUDE.md — Popyplan Panel

> `AGENTS.md` es una copia de este fichero: si actualizas uno, actualiza el otro.

Panel web de Popyplan (Next.js 15, App Router, TypeScript estricto,
Tailwind CSS 4, TanStack Query 5, `next-intl` v4). Consume la misma API
Django/DRF que `~/Code/popyplan-mobile` (repo backend: `~/Code/popyplan`,
contratos en `docs/PANEL.md` y `docs/SEGURIDAD_Y_MODERACION.md` de ese
repo). Login JWT contra el backend; sin servidor de datos propio.

Este fichero se carga en cada sesión: aquí van las reglas vigentes y las
trampas. El porqué detallado de cada tarea, fase y auditoría vive en
`docs/historial/` (ver «Índice del historial» al final); léelo cuando
toques ese área.

## Qué es

Tres áreas por rol, cada una bajo su propia ruta, más la web pública:

- **`/entidad/[slug]`** — panel de una asociación/ONG/administración con
  rol de `OrgMembership` (`titular`, `moderador`, `dinamizador`,
  `analista`, `referente`). Menú por rol en `lib/auth/entidadMenu.ts`
  (`entidadMenuFor(role, { isOnCall })`): «Guardia» la ve además la
  persona de guardia de la entidad sea cual sea su rol
  (`lib/auth/organization.ts::isOnCallUser`). La matriz sale de los
  permisos reales del backend (`entities/permissions.py`,
  `panel/viewsets.py`), nunca inventada: p. ej. `dinamizador` no ve
  Personas, Guardia, Comunicaciones, Reportes, Informes ni Configuración;
  Programas lo ven los cinco roles; Informes exige `exportar_informes`
  (titular/moderador/analista).
- **`/paraguas/[slug]`** — área de administración de una entidad paraguas
  (diputación, ayuntamiento…): Inicio, Territorio (observatorio del
  territorio declarado, `territory_kind`/`territory_code`), Red financiada
  (dashboard agregado del árbol `parent`/`children`) e Informes
  (`lib/auth/paraguasMenu.ts::paraguasMenuFor`). **Territorio ≠ árbol de
  entidades**: son independientes.
- **`/plataforma`** — equipo de Popyplan (`safety.PlatformRole`:
  `superadmin`, `verifier`, `moderator`, `support`), menú por rol en
  `lib/auth/plataformaMenu.ts::plataformaMenuFor`. Las secciones del admin
  antiguo (Usuarios, Bloqueos, Comunidades, Actividades, Reseñas, Chats,
  Notificaciones, Nomencladores, Búsqueda del tesoro) son **solo
  `superadmin`** porque el backend las abre por `is_staff`, no por
  `PlatformRole`.
- **`/`** — sin sesión, la landing pública (`components/landing/`); con
  sesión, repartidor de áreas; con sesión sin rol de panel,
  `AppAccountScreen` («Tu cuenta es de la app»).

**Resolución de área** (`lib/auth/area.ts::resolveArea(me, platformRole)`):
el rol de plataforma manda sobre cualquier rol de entidad; con ≥1
membresía paraguas se va al primer paraguas del array sin pasar por
`/elegir-entidad` (fijado en `lib/auth/area.test.ts`); con varias
entidades normales, `/elegir-entidad`.

- `isParaguas` mira primero `OrgMembershipRef.is_administration`, **con
  precedencia aunque valga `false`**; solo si el campo no viene cae a
  `organization_type`/`org_type` === `'administracion'` (respaldo para
  backends viejos; `OrgMembershipForArea` lo deja opcional a propósito).
- `PLATFORM_ROLES`/`isPlatformRole` (`lib/auth/plataformaMenu.ts`) son la
  **única** definición de «rol de plataforma». Nunca compruebes
  `if (session.platformRole.role)` por veracidad (provocó bucles de
  redirección). Quien añada un rol en el backend tiene que añadirlo ahí.
- Todo gate de página (Server Component) filtra con la misma función de
  menú que el layout (`entidadMenuFor`/`paraguasMenuFor`/
  `plataformaMenuFor`) y pinta `EmptyState` «Sin acceso» si no toca. No
  sustituye al backend (que sigue devolviendo 403): evita pantallas rotas
  por URL directa.
- **Quien pinta un enlace no puede suponer el permiso de destino**: si el
  destino está fuera del menú del rol, no se enlaza (p. ej.
  `ActividadesTable::canOpenAttendance`, `GuardiaPanel::canOpenPersonSheet`,
  las «Pantallas relacionadas» de la ayuda filtradas por
  `visibleSections`).

## Contratos que consume (de un vistazo)

- `POST /api/auth/login/` → `{key, refresh, user}`;
  `POST /api/auth/token/refresh/` → `{access, refresh}` (rotado);
  `POST /api/auth/logout/ {refresh}`.
- `GET /api/users/users/me/` (perfil + `org_memberships` con
  `organization_type`/`is_administration`, `preferred_language`);
  `GET /api/safety/platform-roles/me/` → `{role|null}`;
  `GET /api/organizations/{id}/` (cabecera, logo, colores, guardia).
- `GET /api/panel/{entidad,paraguas,territorio,plataforma}/…/{metrics,
  export,compare}/` — esquema fijo (`people`, `events`, `attendance`,
  `communities`, `by_place`, `by_weekday_hour`, `series`) y **un solo
  `group_by` por petición** (varias llamadas si se quieren varios
  desgloses; en `compare` es obligatorio). Periodo ≤1461 días medido como
  **diferencia** `(until - since).days`, igual que el backend.
- Personas, actividades, check-in, invitaciones, comunicaciones,
  encuestas, biblioteca, familias, programas, billing, territorio y
  admin: rutas en `lib/api/endpoints.ts`, tipos en `lib/api/types.ts` /
  `lib/api/types.generated.ts` (`npm run gen:types`). No los repitas aquí.

### Esquema vs. backend real: política y trampas recurrentes

- `docs/schema.yaml` (drf-spectacular) **miente a menudo**. Antes de fiarte
  de una forma de respuesta, verifícala leyendo el viewset/serializer del
  backend. Los tipos que no cuadran se escriben a mano en
  `lib/api/types.ts` **con el motivo documentado al lado**.
- **Paginado vs. array plano** — la trampa que más bugs reales ha dado,
  siempre invisible en Vitest porque el test mockeaba la forma, no la
  real. Planos de verdad (aunque el esquema diga paginado):
  `reports/queue`, `events/{id}/attendees/`, `blocks/admin/`,
  `/api/treasure-hunt/`, mensajes de chat de admin. Paginados de verdad
  (aunque el esquema diga plano): `panel/.../people/`, encuestas. Ante la
  duda, pide la ruta al backend sembrado.
- Respuestas de acción que no son el modelo (`attendance/` →
  `{user_id, status}`, `checkin/` → `{status, already}`, reseñas `DELETE`
  → 200 `{message}`…). Algunos rechazos vienen como `{"error": …}`, que
  `detailOf` ya lee.
- Quirk de spectacular: un campo con `default` sale obligatorio en los
  `Patched*Request` pese a `partial=True` → tipo manual con todo opcional.
- **Clave de caché string↔number**: un id de ruta (string) y un id de API
  (number) nunca casan en `invalidateQueries` (`1 !== "1"`), y la UI se
  queda con datos viejos sin error. Normaliza siempre con `String(id)` en
  la clave. Los tests de invalidación comprueban
  `getQueryState(...).isInvalidated`, no que se llamara a
  `invalidateQueries`.
- `useEntityCommunities` pide `?owner_org=<orgId>` (modo privilegiado:
  trae privadas y espacios de familias); con tope de páginas que **lanza**
  en vez de truncar en silencio.
- Contenido escrito por una entidad (nombres, títulos, comunicaciones) se
  pinta **tal cual**, en su idioma: el panel traduce su interfaz, nunca el
  contenido ajeno.

## Invariantes y reglas de seguridad (nunca romper)

- **Sin datos de contacto (invariante 9)**: ninguna vista de personas,
  asistencia, guardia, red de apoyo ni admin muestra `email` de personas
  de la entidad, `phone`, `birth_date`, `document*` ni notas libres. Se
  cumple porque los tipos (`PersonRow`, `PersonDetail`, `Attendee.user`…)
  no los traen: quien añada un campo comprueba primero el tipo del
  esquema; **nunca confiar en filtrar a mano** ni inventarse un campo.
  Donde procede se pinta la línea fija «Popyplan no guarda teléfonos…»
  (`lib/help/noPhoneNotice.ts`, única fuente). Nunca pintes ids de cuenta
  en crudo: usa `public_name`.
- **Supresión <5** (`PANEL_MIN_GROUP_SIZE=5`): una celda llega
  `value: null, suppressed: true`. `lib/metrics/format.ts`
  (`formatCount`/`formatPct`) es el **único** sitio que decide qué pintar
  (`'<5'`, `'—'` o el valor en formato del idioma); los componentes
  (`StatCard`, `MetricsTable`…) reciben la cadena ya formateada y nunca
  deciden la supresión. La decisión es por celda (`value` manda). En la
  comparativa, un delta suprimido se pinta «—» con
  `aria-label="No disponible por umbral de agregación"`, nunca «<5».
- **Sin alta de cuentas desde el panel de entidad (invariante 3)**: las
  personas entran por invitación (`useInvite`, importación CSV/XLSX con
  `dry_run` previo). La única creación de cuentas es la de plataforma
  (`superadmin`, `admin-register`), sin `is_staff`/`is_superuser`.
- **Un programa nunca lista personas** (invariante 1 extendida), ni para
  el titular. La ficha de municipio de Territorio solo da agregados.
- **Banner de anonimato de encuestas**: la cadena literal «Las respuestas
  son anónimas y agregadas.» se pinta siempre al principio de los
  resultados, en cualquier estado (única fuente
  `SurveyResultsView.tsx::ANONYMITY_BANNER`). No la reformules ni la
  hagas condicional.
- **Familias separadas (invariante 1)**: nadie declara ser familiar de
  nadie; banner literal «Las comunidades de familias están separadas de
  las de miembros; nadie declara ser familiar de nadie.». El espacio
  (`space`) de una comunidad nunca se edita tras crearla; el espacio de
  familias nace `private`. La audiencia «Familias» de Comunicaciones/
  Biblioteca solo se habilita si existe una comunidad `space === 'families'`.
- **Red de apoyo**: el panel solo lee. La sección «Red de apoyo» de la
  ficha solo se monta (y solo se pide) para `role === 'referente'`; con
  403/404 **no se pinta nada**, ni cabecera (su mera existencia es un
  dato). Nunca contacto, fechas, quién invitó, ni una lista de quién
  acompaña a quién fuera de esa ficha. En Familias solo contadores; en la
  guardia, los «me encargo» sin la relación.
- **Actividades desde el panel** nacen selladas por la entidad
  (`owner_org`, invariante 2); al editar nunca se mandan
  `audience`/`community`/`owner_org` (`EventUpdateFields` los excluye) y
  `starts_at`/`start_time` solo viajan si cambiaron **por minuto**
  (`lib/events/validation.ts::sameMinute`): el backend los exige futuros.
- Acciones destructivas o irreversibles siempre con `ConfirmDialog`
  (revocar, borrar, quitar del equipo, cancelar actividad, finalizar
  contrato…). Solo `superadmin` edita sede/nivel/territorio de una
  administración; nunca el titular.
- Plataforma: los botones de escritura que un rol no puede usar se
  **ocultan**, no se deshabilitan.

## Diseño de sesión (y sus trampas)

- Access token **solo en memoria** (`lib/auth/tokenStore.ts`, nunca
  localStorage). La cookie httpOnly `pp_session` guarda **el refresh**
  (30 días, rotado y en lista negra en cada uso).
- Route handlers: `POST /api/session` (login; también fija `pp_lang` desde
  `preferred_language`), `POST /api/session/refresh` (rota y devuelve
  `/me/` + rol), `DELETE /api/session` (logout best-effort con timeout de
  5 s).
- **`middleware.ts` hace el refresco por navegación** (un Server Component
  no puede escribir cookies: si refrescara él, el refresh rotado se
  perdería) y pasa el access como cabecera interna `x-pp-access-token`,
  que se borra siempre de la petición entrante (no se puede forjar).
  `getServerSession` solo lee esa cabecera, por eso `/` está en el
  `matcher`.
- **Single-flight** por valor de refresh en middleware y route handler
  (`lib/auth/singleFlight.ts`) + `rotationCache` de 3 s en el route
  handler. Solo cubren la carrera **dentro de cada proceso** (Edge y Node
  no comparten memoria).
- **El middleware nunca borra la cookie.** Solo la borran el route
  handler de refresco (que consulta la caché de replay) y el logout. Ante
  refresh rechazado: navegación de documento → `/login?returnTo=` (salvo
  `/`, que pasa sin sesión: es la landing); prefetch/RSC → pasa sin
  sesión. Error de red → 503, nunca logout. 200 ilegible → 503.
- `returnTo` validado por allowlist (`lib/auth/returnTo.ts`).
- **Frontera de confianza `X-Forwarded-For`** (`lib/auth/clientIp.ts`): se
  reenvía la IP real en las cuatro llamadas de auth porque el límite de
  login del backend es por IP (`ip:<ip>:auth`, compartido con
  `token/refresh/`). El proxy de delante tiene que **fijar**
  `X-Forwarded-For`, **nunca anexar**, o el límite se salta rotando la
  cabecera. Trade-off asumido; el arreglo duradero es del backend.
- **`retry: false` global** (`app/providers.tsx`): nada se reintenta solo;
  un 5xx del refresco se propaga como error de la consulta (`ErrorState`).
  Solo el 401 cierra sesión. `bootRestoreSession` memoiza el arranque
  (StrictMode lanzaría dos refrescos).
- Descargas de ficheros por `fetchWithAuth` (refresca y reintenta) +
  `lib/download/triggerDownload.ts` (revoca el blob en el turno
  siguiente) + `filenameFromContentDisposition`.
- `lib/api/baseUrl.ts::apiBaseUrl()` lanza en producción sin
  `NEXT_PUBLIC_API_URL`; llámalo dentro de la función, nunca a nivel de
  módulo. `lib/api/serverFetch.ts` no reintenta nunca.
- Imágenes remotas: `images.remotePatterns` derivado de
  `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_MEDIA_HOSTS` (fijado en build).
  **Nunca montes `<Image>` remoto sin `isAllowedImageSrc(src)`**
  (`lib/config/imagePatterns.ts`): `next/image` lanza en render con un
  host no declarado y tumba el layout.
- Cabeceras de seguridad en `lib/config/securityHeaders.ts`;
  `camera=(self)` es a propósito (check-in QR). **Sin CSP** a propósito
  (exige nonce desde el middleware; no añadirla a medias).

## Reglas por área que no se deducen del código

- **Inicio de entidad**: los contadores de guardia (ayuda pendiente,
  reportes) son 403 para quien no modera ni es la guardia → `count: null`
  y tarjeta oculta. `reports/queue` es array: se cuenta `.length`.
- **Personas**: un `referente` sin `Reference` hacia la persona recibe
  **404** (no 403); `usePerson` trata ambos como «Sin acceso». Filas
  invitadas (`include_invited`) se distinguen por `invitation_id`
  (`lib/people/invitedRow.ts`). `useInvitations` solo da el recuento, no
  duplica el listado. Un 404 de página vuelve a la página 1.
- **Equipo** (`GET .../members/`) es **solo titular** en el backend:
  `moderador` no ve la pestaña, los selects de referente le salen vacíos
  y en Guardia ve los ajustes en solo lectura. `Reference.referent` es el
  id de la **`OrgMembership`**, no de la cuenta: compara con `m.id`.
- **Guardia**: `on_call_user` admite cualquier membresía; se guarda junto
  al teléfono en un solo `PATCH` (solo titular); vaciarla manda `null`,
  el teléfono vacío manda `""` (no nullable). Una guardia que ya no está
  en el equipo se avisa y se manda `null`.
- **Asistencia/check-in**: marcar exige actividad empezada; check-in en
  ventana `-2h..+12h` (409 con el mensaje literal); `already: true` es
  aviso, no error. El QR admite token o `popyplan://checkin/<token>`.
- **Actividades**: la tabla arranca en «Este mes» (hasta hoy); lo futuro
  se ve con rango personalizado y, al crear, el periodo se amplía hasta
  la fecha nueva (`periodIncluding`). El municipio lo deriva el backend
  de las coordenadas: el panel nunca manda código INE. Mensajes de
  validación copiados literalmente del `.po` del backend.
- **Comunidades**: el código de invitación solo existe para `private`
  (no montes el hook con otra visibilidad: 400).
- **Programas**: `budget_cents` obligatorio; el informe se descarga con
  `format` solo (el periodo lo pone el programa).
- **Territorio**: el ámbito `territorio` puede responder **409
  `sin_territorio`** — es configuración que falta, se pinta con
  `EmptyState`, nunca `ErrorState`. El mapa (`react-leaflet`, `ssr:
  false`, mockeado en `vitest.setup.ts`) es `role="img"` y nunca la única
  vía: la tabla por municipio es la alternativa completa. Sede
  obligatoria al guardar (el backend rechaza `place: null`).
- **Plataforma**: la ayuda pendiente global es una sola llamada sin
  `organization`. El estado de una cuenta (`is_active`) no viaja en
  ninguna respuesta de usuarios: la ficha lo localiza por correo en la
  URL (trade-off documentado). Nada del admin antiguo queda en
  `AuditLog`; los chats de soporte salen con la cuenta propia de staff.
  Plantillas de notificación nuevas nacen **inactivas**. 500 de unicidad
  en nomencladores → `conflicto_servidor`.
- **Entrenamiento** (`docs/PANEL.md` §17 del backend): el panel solo toca
  el catálogo (disciplinas, ejercicios) y las plantillas **de Popyplan**
  en Nomencladores (`hooks/useTrainingCatalog.ts`,
  `components/plataforma/nomencladores/`). Plantillas siempre con
  `?scope=system`; **nunca** entrenos, rutinas ni perfiles deportivos de
  nadie (no hay endpoint ni tipo para ellos en el panel, a propósito).
  Nombres: se editan `name_es`/`name_eu`/`name_ca` y se escribe
  `name`/`name_eu`/`name_ca` (`name` sale traducido: guardarlo pisaría el
  castellano). Borrar una disciplina en uso → 409 literal (`en_uso`).
  Guardar una plantilla manda `items` entero (reemplaza) y
  `discipline_id` solo si cambió. Nivel de actividad
  (`lib/events/level.ts`): `""` = todos los niveles; al editar solo viaja
  si cambió. La fila de `panel/.../events/` no trae `level`, así que la
  tabla de Actividades no lo enseña.
- **Programa de seguimiento** (`docs/PANEL.md` §18 del backend, datos
  de salud): el backend responde **404** (nunca 403) a quien no puede usar
  una ruta del programa, y el panel sigue igual: el menú «Programa de
  seguimiento» (`seguimiento`) solo existe para titular/moderador con
  `tracking_program_enabled` (`entidadMenuFor(role, { trackingEnabled })`),
  su página hace `notFound()` en cualquier otro caso, y en la ficha el
  bloque de inscripción solo se monta para titular/moderador con el
  servicio. Titular/moderador ven **estado y configuración, nunca datos**.
  «Seguimiento compartido» solo se pide con `role === 'referente'` y el
  servicio encendido (cada lectura va a `AuditLog`); en vuelo o con 404
  **no se pinta nada** (misma regla que la red de apoyo). El referente de
  una inscripción es el id de la **`OrgMembership`** (`m.id`). El
  interruptor de plataforma es solo `superadmin`, con `ConfirmDialog` y el
  400 del backend literal.
- **Exportación**: `ExportPanel` con `group_by=year` **sustituye** al
  desglose del dashboard, nunca lo combina. `Content-Disposition` llega
  porque el backend declara `CORS_EXPOSE_HEADERS`.

## Deuda conocida (no son bugs)

- Refresco sin caché compartida entre runtimes/instancias (ver sesión);
  `OutstandingToken`/`BlacklistedToken` crecen sin `flushexpiredtokens`
  en el backend.
- `ContratosPanel.tsx` >700 líneas (cortar por sus tres `*Tab`).
- Ids estáticos en avisos de error de selects (pasar a `useId()` si se
  montan dos instancias); regiones `role="status"/"alert"` montadas junto
  al mensaje en vez de persistentes.
- «Rechazar» solicitud de comunidad sin confirmación.
- Landing sin `Vary: Accept-Language` (añadirlo si se pone un CDN).
- Pendientes del backend por área: en `docs/historial/`.

## Convenciones de código

- Textos de UI vía catálogos (ver i18n); identificadores de código en
  inglés.
- **Páginas**: Server Component (sesión + membresía/rol + gate + redirect)
  que delega en un componente cliente de `components/<area>/*.tsx` con
  hooks de `hooks/`. Permisos de acción (`canManage`, `canExport`…)
  calculados en el Server Component y pasados como prop.
  `getServerSession`/`getServerOrganization` van con `cache()` de React.
  Ids de ruta inválidos → `notFound()` antes de pedir nada.
- **Hooks de datos**: traducen `ApiError` a una clase de error con `kind`
  corto (`sin_acceso`, `invalido`, `desconocido`…) y `message` en español
  (se mantiene: lo leen los tests). Los 403 de contadores tolerantes se
  traducen a `null` y la tarjeta se oculta; un fallo real pinta «No
  disponible» (ocultar se lee como un cero). Un select/consulta auxiliar
  que falla avisa con `role="alert"`, nunca queda vacío en silencio.
- **Errores DRF**: `lib/api/drfError.ts::detailOf` es el único lector
  (`detail` → `error` → primer string de cualquier campo). Si el hook
  combina el `detail` del backend con un mensaje propio, la clase gana
  `detail?` además de `message`. En el componente,
  `lib/i18n/errorKindText.ts::errorKindText(error, KEYS, t, fallbackKey)`
  con un `Record<Kind, clave>` explícito; el `detail` del backend tiene
  prioridad y nunca se traduce. Claves bajo `errors.<hook>.<kind>`.
- **Error de mutación en un diálogo**: el mensaje se pinta **dentro** del
  `ConfirmDialog`/`Dialog` (`<p role="alert">` en `description`),
  `reset()` al abrir y al cancelar, y se cierra **solo** en el `onSuccess`
  de `mutate`. Los formularios limpian campos en `onSuccess`, no tras
  `mutate`.
- **Diálogos**: `Dialog`/`ConfirmDialog` atrapan el foco
  (`lib/a11y/useFocusTrap.ts`) y, con `pending`, ni `Escape` ni × ni
  «Cancelar» cierran (`aria-busy`). Un formulario que edita «el elemento
  X» lleva `key` por elemento (sin ella, editar A → editar B sobrescribió
  B con los datos de A).
- Buscadores de texto con `hooks/useDebouncedValue.ts` (300 ms); los
  `<select>` no se debouncean. **Test de retardo**: `userEvent` se cuelga
  con `vi.useFakeTimers()` en esta suite; usa `fireEvent.change` +
  `act(() => vi.advanceTimersByTime(300))` y `vi.useRealTimers()` al
  principio del `afterEach`.
- Etiquetas de valores del contrato con reserva al valor crudo
  (`lib/reports/labels.ts`, `lib/support/relationshipLabel.ts`…); nunca
  pintes el valor crudo como texto de UI a propósito.
- CSV del cliente con `lib/csv/toCsv.ts` (separador `;`, BOM, comillas
  RFC 4180, prefijo `'` anti-fórmulas solo sobre strings).
- Dinero con `lib/programs/money.ts` (`eurosToCents`/`formatEuros`,
  reutilizado en billing); nunca un segundo formateador.
- `apiFetch` acepta `FormData` tal cual (multipart: no fijes
  `Content-Type`).

## Internacionalización

- Idiomas de interfaz `es` (por defecto), `eu`, `ca`
  (`lib/i18n/languages.ts`). **`messages/en.json` es la cadena fuente** y
  entra en la paridad, pero nunca se ofrece como idioma. Cuatro catálogos
  `messages/{en,es,eu,ca}.json`; `lib/i18n/messages.test.ts` exige las
  mismas claves hoja, sin vacíos y los mismos parámetros ICU. Glosario:
  `docs/i18n/glosario.md`; lo que no se corrige de paso va a
  `docs/i18n/PENDIENTES.md` (eu/ca pendientes de revisión nativa).
- Todo literal de UI pasa por `t()` (`useTranslations`/`getTranslations`);
  claves jerárquicas `area.pantalla.elemento`; nada de claves construidas
  por concatenación salvo un mapa explícito con todas las variantes;
  plurales como ICU. El valor en `es` es el literal que había.
- Sin segmento `[locale]`: idioma por cookie `pp_lang` (no httpOnly) →
  `Accept-Language` → `es`, resuelto solo por
  `lib/i18n/cookie.ts::resolveLanguage`. Todas las peticiones al backend
  mandan `Accept-Language`. Formateadores por idioma vía
  `lib/i18n/locale.ts::localeFor`/`activeLanguage()`.
- **Idioma de la cuenta al entrar**: el login fija `pp_lang` en la misma
  respuesta y `LoginForm` navega con
  `lib/navigation/hardNavigate.ts` (documento completo). Nunca vuelvas a
  `router.refresh()` + `router.replace()` en el login: compiten y dejan
  la pantalla a medio catálogo.
- ESLint `react/jsx-no-literals` (hijos JSX, `ignoreProps: true` a
  propósito) + guarda `no-restricted-syntax` que prohíbe literales con
  letras en `aria-label`/`aria-description`/`placeholder`/`title`/`alt`.
  Un ejemplo técnico que no es prosa va en una constante referida como
  expresión.
- Tests: `render()` de `test-utils/render.tsx` envuelve con el catálogo
  `es` real; `next-intl/server` está mockeado entero en `vitest.setup.ts`
  (con `createTranslator` real: una clave que falte rompe el test);
  Server Components con `renderServer(Page({ params }))`.
- Funciones puras que no pueden llamar a `t()` devuelven una clave o un
  `kind`, y traduce el componente.

## Ayuda por pantalla

- Botón «?» (`components/help/PageHelp.tsx`) en las tres cabeceras.
  Registro `lib/help/pageHelp.ts::PAGE_HELP`: **toda `page.tsx` de las
  tres áreas tiene entrada** (un test recorre `app/` y falla si falta o
  sobra). Texto en `messages/*.json::help.<key>.*` (`title`, `summary`,
  1-4 `actions`, `audience`, `details`, 1-3 `tips`, 1-3 `related`).
- `related`: claves existentes en `PAGE_HELP`, sin autorrelación ni
  duplicados, **idénticas y en el mismo orden en los cuatro catálogos**,
  y nunca una ficha (solo `[slug]` como segmento dinámico). Se filtran por
  `visibleSections` del rol; la cabecera «Pantallas relacionadas» solo
  aparece si queda algún botón.
- Un texto por pantalla, no por rol (el texto dice «Solo titular y
  moderador…»). Pantallas fuera de las áreas no llevan ayuda.
- El botón lleva fondo blanco propio (sobre la cabecera de marca
  `text-primary-700` quedaba invisible); no lo quites.

## Diseño visual, densidad y accesibilidad

- Panel **minimalista y denso**. La escala `text-*` está remapeada en
  `app/globals.css` (`@theme`): `text-sm` 13px, `text-base` 15px,
  `text-lg` 16px, `text-xl` 18px, **`text-2xl` es 20px** (no 24).
  `text-xs` 12px; nada baja de 12px; `html` sigue a 16px.
- Medidas: controles y botones de 32px (`min-h-8`), cabecera de 48px,
  `h1` 18px, `Card` sin sombra con 12px de relleno, filas de tabla ~31px,
  menú lateral `SideNav` de 200px (activo con `aria-current` + fondo
  `primary-100` + negrita, nunca solo color).
- **Contraste**: `--color-primary` (`#1fb3ae`) solo para superficies
  decorativas sin texto; todo texto, enlace, botón, borde de control o
  foco usa `--color-primary-700`. `grep -rn "text-primary\b\|bg-primary\b"
  app components` no debe encontrar nada. La regla está tabulada contra
  blanco: sobre fondo de marca se invierte (anillos de foco blancos,
  botones con fondo blanco propio). Pares auditados por
  `lib/a11y/tokens.test.ts`; cabecera de entidad con
  `lib/a11y/contrast.ts::readableOn`. Colores del mapa como literales hex
  a propósito (Leaflet los escribe como atributos SVG), atados a
  `globals.css` por `lib/metrics/mapScale.test.ts`.
- Misma paleta que `popyplan-mobile/app/_theme/colors.ts`; sin lenguaje
  visual nuevo.
- `eslint-plugin-jsx-a11y` en `strict`; toda tabla con `<caption>`
  (`Table.tsx` la exige); `SkipLink` + `<main id="main-content"
  tabIndex={-1}>` en cada layout; `aria-pressed` en los selectores de
  botones (sin ARIA tabs); columnas de acciones con `<th>` `sr-only`.
- **Tests de página**: el primer test del `describe` de cada
  `page.test.tsx` cubierto es «no tiene violaciones de accesibilidad
  (axe)» (`vitest-axe`, `test-utils/axe.ts` desactiva `region` y
  `color-contrast`). Lista viva: `grep -rln "toHaveNoViolations" app
  components`; las páginas sin axe están en la declaración de
  `/accesibilidad`. Nunca solo snapshot: aserciones de texto/acción con
  fixtures realistas (`test-utils/fixtures/*.ts`).

## Entorno y flujo de trabajo

- **Puerto 3100** es el panel de desarrollo en vivo del propietario,
  servido desde el checkout principal: **nunca** `next build` (ni
  `npm run build`) en ese checkout mientras corre, porque pisa su `.next`.
  Los agentes trabajan en worktrees. `playwright.config.ts` también usa
  3100 (`next dev`); con el panel del propietario levantado, usa
  `PANEL_BASE_URL` o un worktree/puerto propio.
- **Puerto 3000**: panel de demo en `.worktrees/demo/`; no se toca.
- Backend local en `[::]:8001` (`NEXT_PUBLIC_API_URL=http://localhost:8001`).
- Metro (la app móvil) nunca con `CI=1`.
- Para verificar a mano con Playwright contra el backend sembrado, usa
  `next start` en otro puerto (3300/3400…), no `next dev`: los ficheros
  que escribe el MCP de Playwright en la raíz disparan un bucle de Fast
  Refresh.
- Env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MEDIA_HOSTS`,
  `NEXT_PUBLIC_SITE_URL`… (`.env.example`; las `NEXT_PUBLIC_*` se fijan en
  build). Nunca commitear `.env.local`.
- Ramas: se trabaja en `develop`; con CI verde, `main` se actualiza por
  fast-forward al mismo commit (`git push origin <sha>:main`), sin PR.
- Detalles de e2e (límite de login 5/min/IP, fixtures, CI):
  `e2e/CLAUDE.md`. Reglas de la landing: `components/landing/CLAUDE.md`.

## Comandos

- `npm run dev` / `npm run build` / `npm run start`
- `npm run typecheck` (`tsc --noEmit`)
- `npm run lint` (ESLint + `jsx-a11y` strict + `jsx-no-literals`)
- `npm run test` / `npm run test:coverage` (Vitest + Testing Library)
- `npm run gen:types` — regenera `lib/api/types.generated.ts` desde
  `../popyplan/docs/schema.yaml`; se commitea.
- `npm run e2e` (Playwright contra el backend real)

Verificación antes de cerrar cualquier tarea:
`npm run typecheck && npm run lint && npm run test:coverage && npm run build`
(el build, nunca en el checkout del puerto 3100; `npm run e2e` también
cuando haya backend local sembrado — en CI lo gatea el job `e2e`).

## Cobertura

- Vitest mide líneas sobre `lib/**`, `hooks/**`, `app/**/*.ts` y
  `middleware.ts`; nunca `.tsx` (páginas, layouts, componentes se prueban
  por comportamiento).
- Umbral con ratchet en `vitest.config.ts`
  (`coverage.thresholds.lines`): **solo puede subir**. Comprueba la
  cobertura real al cerrar, no solo que pase.
- `lib/api/consumption.test.ts`: todo endpoint de `lib/api/endpoints.ts`
  se usa y tiene test; la allowlist de pendientes solo puede encoger.
- Cada `page.tsx` y cada layout con lógica de rol tiene su test.

## Índice del historial (`docs/historial/`)

- `paraguas-territorio.md` — «Qué es» original con la historia de la regla
  de paraguas; administraciones multinivel y territorio (bloque 1: mapa,
  409 `sin_territorio`, sede, renombres Biblioteca/Suscripciones, tipos
  manuales y pendientes del backend).
- `metricas-y-exportacion.md` — vista del financiador (W2), exportación,
  comparativa entre ámbitos y memoria plurianual.
- `entidad.md` — Inicio/Personas/Actividades/Asistencia (W3, check-in QR,
  mismatches), invitaciones e importación (W3b), Comunicaciones/Encuestas/
  Biblioteca (W4b), Familias, Red de apoyo (Fase 7, cuentas de demo),
  Programas, crear/editar/cancelar actividades.
- `plataforma.md` — área de plataforma (W5: matriz de roles, entidades,
  reportes, ayuda, verificaciones, roles, auditoría) y suscripciones/
  facturación.
- `admin-plataforma-2026-09-26.md` — usuarios y bloqueos, búsqueda del
  tesoro, resto del admin antiguo; mismatches y pendientes del backend.
- `entrenamiento-2026-09-26.md` — catálogo de entrenamiento en
  Nomencladores y nivel de actividad: decisiones, mismatches y pendientes.
- `programa-seguimiento-2026-09-26.md` — programa de seguimiento (fase 1
  del panel + vista del referente): permisos, decisiones y mismatches.
- `sesion-y-seguridad.md` — diseño de sesión completo y hardening.
- `accesibilidad-y-e2e.md` — cierre W6: carry-overs, bugs hallados por e2e,
  accesibilidad (tabla de contraste, declaración), e2e y CI.
- `auditorias.md` — auditoría estática 2026-09, segunda ronda 2026-09-18
  (F1-F5, deuda anotada), integración app↔backend↔panel 2026-09-21 y
  auditoría de producto 2026-09-24.
- `ayuda-por-pantalla.md` — decisiones y ampliación de la ayuda.
- `i18n.md` — infraestructura i18n, patrón de errores de hooks, cierre
  (selector, idioma de la cuenta, ESLint) y el arreglo del idioma mezclado.
- `densidad-y-cabecera.md` — pasada de densidad, selector de idioma
  desplegable y menú de cuenta.
- `landing.md` — landing pública, login único, rediseño deportivo, SEO y
  pendientes.
