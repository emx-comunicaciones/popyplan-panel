import { expect, test } from "@playwright/test";

/**
 * Smoke de login contra un backend Django real en `http://localhost:8001`
 * (`make seed-catalogs` + migraciones aplicadas). Usa la persona
 * `panel-titular@test.com` / `panel-pass-1234` del futuro comando
 * `seed_panel_demo` (backend, tarea P7 del plan de Fase 5): ese comando
 * no existe todavía, así que este test se deja en `test.skip` — no hay
 * ninguna cuenta con ese usuario/contraseña en ningún entorno hoy. Se
 * activa quitando el `.skip` en cuanto `seed_panel_demo` exista y el CI
 * levante el backend (tarea W6, que añade el job de e2e).
 */
test.skip("una persona titular inicia sesión y llega al panel de su entidad", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Usuario o email").fill("panel-titular@test.com");
  await page.getByLabel("Contraseña").fill("panel-pass-1234");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/entidad\//);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
});
