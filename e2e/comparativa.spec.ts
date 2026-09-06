import { expect, test } from "@playwright/test";

import { ANALISTA_GFA_EMAIL, DEMO_PASSWORD } from "./helpers";

/**
 * Analista de la diputación (tarea W5, Fase 6, `docs/PANEL.md` §11): ve
 * el bloque «Comparativa» del Inicio de paraguas, por comarca (desglose
 * por defecto de `ParaguasMetricsDashboard.tsx`), con al menos una celda
 * suprimida (`<5`) o no disponible (`—`) — el volumen de la demo
 * sembrada es pequeño, así que ambos indicadores son esperables.
 *
 * Mismo hueco de contrato que `analista.spec.ts` (`org_type` no
 * distingue esta membresía como paraguas): se navega a la vista de
 * paraguas a propósito, no por redirección automática.
 */
test("analista de paraguas ve la comparativa por comarca con celdas suprimidas", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuario o email").fill(ANALISTA_GFA_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/(entidad|paraguas)\/gipuzkoako-foru-aldundia/);

  await page.goto("/paraguas/gipuzkoako-foru-aldundia");
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();

  // El preset por defecto («Este mes») no deja actividad suficiente en la
  // demo sembrada para que ningún ámbito tenga filas de comparativa
  // (`compare_for` solo devuelve ámbitos con datos en alguno de los dos
  // periodos) — «Año» sí tiene actividad real, con algún ámbito por
  // debajo del umbral de agregación.
  await page.getByRole("button", { name: "Año", exact: true }).click();

  const comparativa = page.locator('section[aria-labelledby="comparativa-heading"]');
  await expect(comparativa.getByRole("heading", { name: "Comparativa" })).toBeVisible();

  // Desglose por defecto: comarca.
  await expect(page.getByLabel("Desglose de la comparativa")).toHaveValue("comarca");

  const table = comparativa.locator("table");
  await expect(table).toBeVisible();
  await expect(table.getByText(/^(<5|—)$/).first()).toBeVisible();
});
