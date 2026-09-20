import { expect, test } from "@playwright/test";

import { ANALISTA_GFA_EMAIL, DEMO_PASSWORD, GFA_SLUG } from "./helpers";

/**
 * Analista de la diputación (tarea W5, Fase 6, `docs/PANEL.md` §11): ve
 * el bloque «Comparativa» de Red financiada, por comarca (desglose por
 * defecto de `ParaguasMetricsDashboard.tsx`), con al menos una celda
 * suprimida (`<5`) o no disponible (`—`) — el volumen de la demo
 * sembrada es pequeño, así que ambos indicadores son esperables.
 *
 * **Actualizado en la tarea 8 del bloque de territorio**: el dashboard
 * completo (tarjetas + comparativa) vivía en el Inicio de paraguas antes
 * de este bloque; ahora Inicio es un resumen de dos bloques
 * (`ParaguasHomeDashboard`, sin selector de periodo) y
 * `ParaguasMetricsDashboard` se mudó a su propia sección «Red
 * financiada» (`lib/auth/paraguasMenu.ts`) — el e2e lo detectó de verdad
 * (el botón «Año» del periodo ya no existe en Inicio), no un cambio
 * cosmético.
 *
 * Como en `analista.spec.ts`, se navega a la vista de paraguas a
 * propósito en vez de depender de la resolución de área del login (que
 * hoy sí lleva ahí, desde que `isParaguas` mira `organization_type`).
 */
test("analista de paraguas ve la comparativa por comarca con celdas suprimidas", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuario o email").fill(ANALISTA_GFA_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`/(entidad|paraguas)/${GFA_SLUG}`));

  await page.goto(`/paraguas/${GFA_SLUG}/red-financiada`);
  await expect(page.getByRole("heading", { name: "Red financiada", level: 1 })).toBeVisible();

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
