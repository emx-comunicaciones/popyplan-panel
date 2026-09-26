# Historial — Diseño de sesión y hardening

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

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
va a `/login?returnTo=<destino>` — **salvo en `/`, que desde la landing
es la web pública y pasa sin cabecera de sesión en vez de ir al login**
(ver «Landing pública y login único» más abajo); toda otra ruta del
`matcher` sigue yendo al login. Un prefetch/RSC pasa sin cabecera en
cualquier ruta, con lo que `getServerSession` devuelve `null` y el
layout redirige;
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
