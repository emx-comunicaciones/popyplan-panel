# Popyplan Panel

Panel web de Popyplan: entidades (asociaciones/ONG/administraciones),
entidades paraguas y equipo de plataforma. Next.js 15 (App Router),
TypeScript, Tailwind CSS 4, TanStack Query 5. Consume la API Django/DRF
del repo hermano `~/Code/popyplan` (ver `CLAUDE.md` para el contrato
completo, el diseño de sesión, accesibilidad y e2e).

## Arrancar en local

1. Backend (`~/Code/popyplan`):
   ```bash
   .venv/bin/python manage.py migrate
   make seed-catalogs
   make seed-panel-demo        # entidades, personas y datos de demo del panel
   .venv/bin/python manage.py runserver 8001
   ```
   `seed-panel-demo` es idempotente (se puede volver a correr sin
   duplicar nada; `RESET=1 make seed-panel-demo` borra antes las cinco
   entidades de demo). Cuentas de prueba (contraseña siempre
   `panel-pass-1234`):

   | Cuenta | Rol | Entidad |
   |---|---|---|
   | `panel-titular-asociacion-bidasoa@test.com` | `titular` | Asociación Bidasoa |
   | `panel-moderador-asociacion-bidasoa@test.com` | `moderador` | Asociación Bidasoa |
   | `panel-dinamizador-asociacion-bidasoa@test.com` | `dinamizador` | Asociación Bidasoa |
   | `panel-analista-asociacion-bidasoa@test.com` | `analista` | Asociación Bidasoa |
   | `panel-referente-asociacion-bidasoa@test.com` | `referente` | Asociación Bidasoa |
   | `panel-voluntario-asociacion-bidasoa@test.com` | `voluntario` | Asociación Bidasoa |
   | (mismos seis roles con `-elkartea-hondarribia`) | — | Elkartea Hondarribia |
   | `panel-analista-gfa@test.com` | `analista` | Gipuzkoako Foru Aldundia (paraguas) |
   | `plataforma@test.com` | `superadmin` (plataforma) | — |
   | `plataforma-verificador@test.com` | `verifier` (plataforma) | — |

   El patrón general es `panel-<rol>-<slug-de-la-entidad>@test.com`
   (slugs: `asociacion-bidasoa`, `elkartea-hondarribia`,
   `ayuntamiento-de-irun`, `ayuntamiento-de-hondarribia`,
   `gipuzkoako-foru-aldundia`). Detalle completo en
   `.superpowers/sdd/2026-09-05-fase-5-panel-web-entidades-y-plataforma/task-P7-report.md`
   del repo backend.
2. Panel (este repo):
   ```bash
   cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8001
   npm install
   NEXT_PUBLIC_API_URL=http://localhost:8001 npm run dev
   ```
3. Abrir `http://localhost:3000` — redirige a `/login`. Inicia sesión
   con cualquiera de las cuentas de arriba; el área (entidad, paraguas o
   plataforma) la decide `lib/auth/area.ts::resolveArea` según el rol.

**Nunca** el puerto 3000 para nada que no sea este arranque normal: el
panel de demo del propietario vive en `.worktrees/demo/` (otro árbol de
trabajo, ignorado por git) y también usa 3000 — no se toca ni se pisa.

## E2E contra el backend real (`e2e/`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8001 npm run e2e
```

`playwright.config.ts` levanta el panel en el puerto **3100** (nunca
3000, ver arriba) y ejecuta los flujos de `e2e/*.spec.ts` contra el
backend local sembrado (arriba). Antes de correrlo: el backend tiene un
límite de **5 logins por minuto y por IP** (`users/rate_limiting.py`) —
la suite completa hace más de 5, así que en local puede saltar un 429
si se corre dos veces seguidas sin esperar; en CI el job `e2e` de
`.github/workflows/ci.yml` arranca el backend con
`DJANGO_SETTINGS_MODULE=pop.settings_e2e`, que desactiva ese límite (y
sustituye la base de datos por SQLite efímero), así que ahí nunca pasa.
Detalle completo (fixtures por API, huecos de contrato encontrados) en
`CLAUDE.md`, sección «Cierre del panel: accesibilidad, e2e...».

**El job `e2e` de CI necesita el secret `BACK_REPO_TOKEN`** (un token
de acceso personal — scope `repo`, o un fine-grained token con
`Contents: read` — con lectura sobre `emx-comunicaciones/popyplan`,
repo privado): Settings → Secrets and variables → Actions de este
repo → New repository secret. Sin él, el job se salta con un aviso
(`::warning::`) y termina en verde sin haber corrido nada — no bloquea
el resto de CI, pero el e2e no se ejecuta hasta que alguien lo cree.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm run start` | Build de producción / arrancarlo |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (incluye `eslint-plugin-jsx-a11y` en `strict`) |
| `npm run test` / `npm run test:coverage` | Vitest + Testing Library, con cobertura y `axe-core` (`vitest-axe`) en las páginas cubiertas |
| `npm run gen:types` | Regenera `lib/api/types.generated.ts` desde `../popyplan/docs/schema.yaml` |
| `npm run e2e` | Playwright contra el backend real (ver arriba) |

Antes de dar por cerrada cualquier tarea:

```bash
npm run typecheck && npm run lint && npm run test:coverage && npm run build && npm run e2e
```

## Estructura

```
app/
  (auth)/login/          página (Server Component, <title>) + LoginForm.tsx (cliente)
  api/session/           route handlers de sesión (login/logout/refresh)
  entidad/[slug]/         panel de entidad (layout con menú por rol; 13 secciones)
  paraguas/[slug]/        panel de entidad paraguas (Inicio + Informes)
  plataforma/             panel de plataforma (8 secciones, matriz por rol)
  elegir-entidad/         selector cuando hay varias entidades
components/ui/           Button, Card, Table, Badge, Stat, Dialog, ConfirmDialog,
                          SkipLink, EmptyState, ErrorState (piezas compartidas)
lib/a11y/                 useFocusTrap (diálogos)
lib/api/                  endpoints, cliente (browser) y serverFetch (Server Components), tipos generados
lib/auth/                 resolveArea, menús por rol, cookie de sesión, sesión de servidor
lib/metrics/              periodo y formateo de métricas (regla de supresión `<5`)
hooks/                    un hook por endpoint/acción (TanStack Query)
test-utils/               render con QueryClientProvider, axe, mocks de next/navigation, fixtures
e2e/                      Playwright contra el backend real (helpers.ts + un spec por flujo)
```

## Variables de entorno

- `NEXT_PUBLIC_API_URL` — URL del backend Django (`.env.example`:
  `http://localhost:8001`). Nunca commitear `.env.local`.

Documentación de decisiones y desviaciones: `CLAUDE.md` (contrato
consumido, diseño de sesión, accesibilidad, e2e y CI) y
`docs/preguntas-diseno.md` (cerrado al final de la Fase 5: cada
pregunta lleva su resolución, o queda documentada como hueco conocido
para una fase posterior).
