import { expect, test } from "@playwright/test";

import { TITULAR_BIDASOA_EMAIL } from "./helpers";

/**
 * Smoke de login contra el backend real (`seed_panel_demo`, tarea
 * backend P7). Activado en la tarea W6 (el job de CI que levanta el
 * backend y ejecuta `npm run e2e` es `.github/workflows/ci.yml`, job
 * `e2e`).
 */
test("una persona titular inicia sesión y llega al panel de su entidad", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Usuario o email").fill(TITULAR_BIDASOA_EMAIL);
  await page.getByLabel("Contraseña").fill("panel-pass-1234");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/entidad\//);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
});

test("contraseña incorrecta muestra el mensaje del contrato", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Usuario o email").fill(TITULAR_BIDASOA_EMAIL);
  await page.getByLabel("Contraseña").fill("una-contraseña-que-no-es");
  await page.getByRole("button", { name: "Entrar" }).click();

  // No usar getByRole("alert") a secas: el «route announcer» de Next.js
  // (`#__next-route-announcer__`) también lleva `role="alert"` y da un
  // «strict mode violation» con dos coincidencias. El formulario de login
  // es el único punto de la página con esta clase de error.
  await expect(page.locator("form [role=\"alert\"]")).toHaveText("Usuario o contraseña incorrectos.");
  await expect(page).toHaveURL(/\/login/);
});
