import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E contra un backend real (`docs/PANEL.md`/`SEGURIDAD_Y_MODERACION.md`).
 * `e2e/login.spec.ts` está en `test.skip` hasta que exista
 * `seed_panel_demo` (tarea P7 del backend) — ver el comentario en ese
 * fichero. El job de CI que lo ejecuta contra un backend en servicio
 * llega en la tarea W6.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PANEL_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
