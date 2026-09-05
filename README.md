# Popyplan Panel

Panel web de Popyplan: entidades (asociaciones/ONG/administraciones),
entidades paraguas y equipo de plataforma. Next.js 15 (App Router),
TypeScript, Tailwind CSS 4, TanStack Query 5. Consume la API Django/DRF
del repo hermano `~/Code/popyplan` (ver `CLAUDE.md` para el contrato
completo y el diseño de sesión).

## Arrancar en local

1. Backend (`~/Code/popyplan`):
   ```bash
   .venv/bin/python manage.py migrate
   make seed-catalogs
   .venv/bin/python manage.py runserver 8001
   ```
   Cuando exista `seed_panel_demo` (backend, tarea P7 de la Fase 5),
   ejecutarlo también para tener personas de prueba con rol de panel
   (`panel-titular@test.com` / `panel-pass-1234`, que usa
   `e2e/login.spec.ts`).
2. Panel (este repo):
   ```bash
   cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8001
   npm install
   NEXT_PUBLIC_API_URL=http://localhost:8001 npm run dev
   ```
3. Abrir `http://localhost:3000` — redirige a `/login`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm run start` | Build de producción / arrancarlo |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (incluye `eslint-plugin-jsx-a11y` en `strict`) |
| `npm run test` / `npm run test:coverage` | Vitest + Testing Library, con cobertura |
| `npm run gen:types` | Regenera `lib/api/types.generated.ts` desde `../popyplan/docs/schema.yaml` |
| `npm run e2e` | Playwright (`e2e/login.spec.ts`, hoy en `test.skip`) |

Antes de dar por cerrada cualquier tarea:

```bash
npm run typecheck && npm run lint && npm run test:coverage && npm run build
```

## Estructura

```
app/
  (auth)/login/        formulario de login (cliente)
  api/session/          route handlers de sesión (login/logout/refresh)
  entidad/[slug]/        panel de entidad (layout con menú por rol + Inicio)
  paraguas/[slug]/       panel de entidad paraguas (placeholder)
  plataforma/            panel de plataforma (placeholder)
  elegir-entidad/        selector cuando hay varias entidades
components/ui/          Button, Card, Table, Badge, Stat, EmptyState, ErrorState
lib/api/                 endpoints, cliente (browser) y serverFetch (Server Components), tipos generados
lib/auth/                resolveArea, menús por rol, cookie de sesión, sesión de servidor
hooks/useAuth.ts         login/logout/restoreSession (cliente)
test-utils/              render con QueryClientProvider, mocks de next/navigation, fixtures
e2e/                     Playwright (smoke de login, en test.skip hasta seed_panel_demo)
```

## Variables de entorno

- `NEXT_PUBLIC_API_URL` — URL del backend Django (`.env.example`:
  `http://localhost:8001`). Nunca commitear `.env.local`.

Documentación de decisiones y desviaciones: `CLAUDE.md` y
`docs/preguntas-diseno.md`.
