import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

import { rutaPersonas } from "./e2e/personas/personas";

/**
 * E2E del panel con los personajes de prueba (`seed_personas` del backend)
 * contra el entorno de pruebas (`scripts/test-env.sh` del backend, :8002).
 * Distinto de `playwright.config.ts` (demo de `seed_panel_demo` en :8001).
 *
 * Levanta el panel con `next build` + `next start` en el **3300**, nunca en
 * el 3100 (el panel en vivo del propietario) ni en el 3000 (la demo): un
 * `next build` en el checkout del 3100 le pisaría el `.next`, así que esta
 * suite se ejecuta desde un worktree o con `PANEL_BASE_URL` apuntando a un
 * panel ya levantado. `NEXT_PUBLIC_API_URL` sale de `personas.json`.
 *
 *     npm run e2e:personas
 */
const PORT = Number(process.env.PERSONAS_PANEL_PORT ?? 3300);
const BASE_URL = process.env.PANEL_BASE_URL ?? `http://localhost:${PORT}`;

function apiDePersonas(): string {
  try {
    return JSON.parse(readFileSync(rutaPersonas(), "utf-8")).api_url;
  } catch {
    return "http://localhost:8002";
  }
}

export default defineConfig({
  testDir: "./e2e/personas",
  // Un solo worker: los contextos por personaje viven en el worker
  // (`fixtures.ts`) y todos comparten el mismo backend sembrado.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-personas" }]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    { name: "sesiones", testMatch: /sesiones\.setup\.ts/ },
    {
      name: "personas",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["sesiones"],
      testMatch: /.*\.spec\.ts/,
    },
  ],
  webServer: process.env.PANEL_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        env: { NEXT_PUBLIC_API_URL: apiDePersonas() },
      },
});
