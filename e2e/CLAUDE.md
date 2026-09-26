# e2e/ — Playwright contra el backend real

Detalle e historia: `docs/historial/accesibilidad-y-e2e.md` (sección «E2E
contra el backend real» y «CI»).

- **Límite de login**: `POST /api/auth/login/` admite **5 intentos por 60 s
  por IP** (clave `ip:<ip>:auth`, compartida entre cuentas y con
  `token/refresh/`). En local, cada spec debe quedarse en ≤4-5 logins (API
  + UI) y la suite completa necesita margen entre specs o da 429. En CI el
  backend corre con `pop.settings_e2e` (`RATE_LIMITING_ENABLED = False`,
  SQLite efímero), así que allí nunca salta.
- `playwright.config.ts` levanta `next dev --port 3100` con
  `NEXT_PUBLIC_API_URL=http://localhost:8001` y `workers: 1` (specs
  comparten backend y límite). **3100 es también el panel en vivo del
  propietario** en el checkout principal: si está levantado, apunta el
  runner con `PANEL_BASE_URL` o trabaja en un worktree. Nunca el 3000
  (demo en `.worktrees/demo/`).
- `helpers.ts`: `apiLogin`, `resolveOrgId`, `expectExportFilename` (solo
  acepta el nombre de respaldo si la respuesta no expone
  `Content-Disposition`), y fixtures para lo que la demo sembrada no puede
  dar por tener fechas relativas: `createCheckinFixture` (actividad que
  empieza en 10 s) y `escalateFirstPendingReport` (la cola global de
  plataforma solo enseña reportes escalados).
- Nunca inventes datos de demo a mano (p. ej. nombres): léelos por API.
  Contraseña de las cuentas `panel-*@test.com`: `panel-pass-1234`.
- El backend local persiste entre ejecuciones (a diferencia de CI): un
  spec que deja estado (p. ej. `preferred_language`) lo resetea por API
  al empezar.
- CI (`.github/workflows/ci.yml`, job `e2e`): checkout cruzado de
  `emx-comunicaciones/popyplan@main` con el secret `BACK_REPO_TOKEN`; sin
  él el job se salta en verde con un aviso. Siembra `load_places`,
  `seed_catalogs`, `seed_panel_demo`; sube `playwright-report/` y
  `test-results/` si falla. Sin `continue-on-error`: un fallo real tumba
  el workflow.
