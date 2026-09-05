import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra un backend real (`docs/PANEL.md`/`SEGURIDAD_Y_MODERACION.md`,
 * seed `seed_panel_demo` de la tarea backend P7). Tarea W6: los flujos de
 * `e2e/*.spec.ts` ya no están en `test.skip` — el job de CI que levanta el
 * backend y los ejecuta está en `.github/workflows/ci.yml` (job `e2e`).
 *
 * `webServer` arranca `next dev` en el puerto **3100** (nunca 3000: ese
 * puerto es el del panel de demo del propietario en `.worktrees/demo/`,
 * que no se toca) con `NEXT_PUBLIC_API_URL=http://localhost:8001` — el
 * backend local sembrado con `seed_panel_demo` (`make seed-panel-demo`,
 * ver `CLAUDE.md`/`README.md`).
 */
const PANEL_PORT = 3100;
const PANEL_BASE_URL = process.env.PANEL_BASE_URL ?? `http://localhost:${PANEL_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Cada spec hace sus propias llamadas de fixture (login, crear una
  // actividad, inscribir a alguien) contra el mismo backend: en paralelo
  // se pisarían entre sí (rate limit de login, entidades creadas a la
  // vez…), así que un solo worker, igual que hace el móvil
  // (`popyplan-mobile/playwright.config.live.ts`).
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: PANEL_BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PANEL_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${PANEL_PORT}`,
        url: PANEL_BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001",
        },
      },
});
