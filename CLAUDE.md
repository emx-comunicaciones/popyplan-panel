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
  una diputación) sobre sus entidades hijas: Inicio (métricas) e
  Informes (exportación), ver «Vista del financiador» más abajo.
- **`/plataforma`** — panel del equipo de Popyplan (`safety.PlatformRole`:
  `superadmin`, `verifier`, `moderator`, `support`). `/plataforma/metricas`
  ya está (ver más abajo); entidades, cola de reportes, verificaciones,
  roles y auditoría llegan en tareas P5-P7.

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
- `docs/SEGURIDAD_Y_MODERACION.md` (§1, §8) y `docs/PANEL.md` (§1
  métricas, §2 exportación) documentan el resto.

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
meses) y valida `since<=until` y ≤366 días (misma regla que el
backend); `lib/metrics/format.ts` formatea. `hooks/useExport.ts` hace el
`fetch` del fichero a mano (no `lib/api/client.ts::apiFetch`, que
siempre espera JSON) y dispara la descarga con un `<a download>`
temporal; 503 (WeasyPrint no disponible, `docs/PANEL.md` §2.3) →
`ExportError('pdf_unavailable')`, 403 → `ExportError('forbidden')`.

Desviación conocida: el brief pedía una columna «asistencia %» en la
tabla «Por municipio», pero `ByPlaceRow` (`docs/PANEL.md` §1.4) no lleva
una tasa de asistencia por fila (solo `events`/`people`) — la tabla
muestra Municipio, Código INE, Eventos y Personas; la asistencia global
solo está en la tarjeta «Asistencia» de la sección base.

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
  handlers y helpers; nunca `.tsx` de páginas/layouts/componentes, que se
  prueban por comportamiento, no por cobertura —
  `components/metrics/*.tsx` tampoco cuenta). Umbral con ratchet en
  `vitest.config.ts` (`coverage.thresholds.lines`): **100 % al cerrar W1
  y W2** (umbral fijado a 99.7, real menos 0.3); solo puede subir.
  Objetivo final del plan de cobertura: ≥98 % (ya superado aquí).
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
