import { expect, test } from "@playwright/test";

import { DEMO_PASSWORD, PLATAFORMA_SUPERADMIN_EMAIL } from "./helpers";

/**
 * Superadmin de plataforma (tarea W5, Fase 6, `docs/PANEL.md` §13):
 * crea un tramo de precio nuevo y lo asigna a un contrato nuevo de
 * Asociación Bidasoa. `PricingTier.name` es único en el backend
 * (`billing/models.py`), así que el nombre del tramo lleva el
 * timestamp de la corrida, igual que `slug`/`cif` en
 * `plataforma.spec.ts` para la entidad de prueba — no hay `DELETE`
 * para tramos ni contratos (invariante de auditoría: no se borran).
 */
test("superadmin crea un tramo de precio y un contrato con ese tramo", async ({ page }) => {
  const tierName = `Tramo E2E ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Usuario o email").fill(PLATAFORMA_SUPERADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/plataforma/);

  await page.getByRole("link", { name: "Contratos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contratos" })).toBeVisible();

  // Tramos: nuevo tramo de precio.
  await page.getByRole("button", { name: "Tramos", exact: true }).click();
  await page.getByRole("button", { name: "Nuevo tramo" }).click();
  const tierDialog = page.getByRole("dialog", { name: "Nuevo tramo" });
  await tierDialog.getByLabel("Nombre").fill(tierName);
  await tierDialog.getByLabel("Población mínima").fill("100");
  await tierDialog.getByLabel("Precio anual (€)").fill("500");
  await tierDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(tierDialog).toBeHidden();
  await expect(page.getByText(tierName)).toBeVisible();

  // Contratos: nuevo contrato de Asociación Bidasoa con el tramo recién creado.
  await page.getByRole("button", { name: "Contratos", exact: true }).click();
  await page.getByRole("button", { name: "Nuevo contrato" }).click();
  const contractDialog = page.getByRole("dialog", { name: "Nuevo contrato" });
  await contractDialog.getByLabel("Entidad").selectOption({ label: "Asociación Bidasoa" });
  await contractDialog.getByLabel("Tramo").selectOption({ label: tierName });
  await contractDialog.getByLabel("Inicio").fill("2026-01-01");
  await contractDialog.getByLabel("Fin").fill("2026-12-31");
  await contractDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(contractDialog).toBeHidden();

  const row = page.locator("tr", { hasText: tierName });
  await expect(row).toBeVisible();
  await expect(row.getByText("Asociación Bidasoa")).toBeVisible();
  await expect(row.getByText("Borrador")).toBeVisible();
});
