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
  una diputación) sobre sus entidades hijas. Placeholder en esta tarea
  (W1); las métricas agregadas llegan en W2+.
- **`/plataforma`** — panel del equipo de Popyplan (`safety.PlatformRole`:
  `superadmin`, `verifier`, `moderator`, `support`). Placeholder en esta
  tarea; entidades, cola de reportes, verificaciones, roles, auditoría y
  métricas por territorio llegan en tareas P5-P7.

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
  `{username_or_email, password}` → `{key, user}`. **Ojo:** solo devuelve
  el access token (`key`); el `refresh` que genera se descarta dentro de
  la vista y no hay ninguna ruta `/api/*token/refresh*` en
  `docs/schema.yaml`. Ver la desviación documentada en
  `lib/auth/cookie.ts`.
- `GET /api/users/users/me/` — perfil propio + `org_memberships`.
- `GET /api/safety/platform-roles/me/` — `{role: string|null}`.
- `GET /api/organizations/{id}/` — ficha de la entidad (nombre, logo,
  `primary_color`/`secondary_color`) para la cabecera del panel.
- `docs/SEGURIDAD_Y_MODERACION.md` (§1, §8) y `docs/PANEL.md` (§1,
  nombres de ruta de métricas que consumirá W2) documentan el resto.

## Diseño de sesión (y su desviación respecto al plan original)

Access token en memoria (`lib/auth/tokenStore.ts`, nunca localStorage).
El plan preveía un refresh token en cookie `httpOnly`; como el backend no
lo expone (ver arriba), la cookie `pp_session`
(`app/api/session/route.ts`, `lib/auth/cookie.ts`) guarda el propio
access token — sirve para restaurar la sesión tras recargar la página
(`app/api/session/refresh/route.ts` valida contra el backend con
`GET .../me/`) y para que los Server Components lean la sesión sin pasar
por memoria de cliente (`lib/auth/session.ts`). `lib/api/client.ts`
(cliente) reintenta una vez tras un 401 llamando a
`/api/session/refresh`; si falla, limpia el token (logout).
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
  handlers y helpers; nunca `.tsx` de páginas/layouts, que se prueban
  por comportamiento, no por cobertura). Umbral con ratchet en
  `vitest.config.ts` (`coverage.thresholds.lines`): **100 % al cerrar
  W1** (umbral fijado a 99.7, real menos 0.3); solo puede subir. Objetivo
  final del plan de cobertura: ≥98 % (ya superado aquí).
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
