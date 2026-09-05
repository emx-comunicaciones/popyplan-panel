# Preguntas de diseño abiertas — Task W1

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
