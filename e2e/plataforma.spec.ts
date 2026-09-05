import { expect, test, type APIRequestContext } from "@playwright/test";

import {
  BIDASOA_SLUG,
  DEMO_PASSWORD,
  PLATAFORMA_SUPERADMIN_EMAIL,
  TITULAR_BIDASOA_EMAIL,
  apiLogin,
  escalateFirstPendingReport,
  newApiContext,
  resolveOrgId,
} from "./helpers";

/**
 * Superadmin de plataforma (tarea W6): login → Entidades (todas las
 * entidades de la demo nacen ya verificadas —`seed_panel_demo`—, así que
 * este flujo crea una entidad nueva y la verifica, en vez de verificar
 * una ya pendiente que no existe) → Reportes (cola global) → abrir uno.
 *
 * **Hallazgo real de este flujo** (carry-over cerrado en la tarea W6,
 * ver `hooks/useReportsQueue.ts`): los reportes de la demo sembrada
 * («Asociación Bidasoa») no aparecen nunca en la cola *global* de
 * plataforma mientras no estén escalados
 * (`docs/SEGURIDAD_Y_MODERACION.md` §4: la cola de plataforma es «sin
 * entidad, escalados, o contra la propia entidad»); `beforeAll` escala
 * el primero por API para que el flujo tenga algo real que abrir.
 */
test.describe("Plataforma", () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await newApiContext();
    const titularToken = await apiLogin(api, TITULAR_BIDASOA_EMAIL);
    const orgId = await resolveOrgId(api, titularToken, BIDASOA_SLUG);
    await escalateFirstPendingReport(api, titularToken, orgId);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("crear y verificar una entidad, y abrir un reporte escalado de la cola", async ({ page }) => {
    const now = Date.now();
    const slug = `e2e-entidad-${now}`;
    const name = `Entidad de prueba E2E ${now}`;
    // `cif` es único en el backend (`entities/models.py::Organization.cif`,
    // `max_length=9`, sin más validación de formato) — un valor fijo choca
    // con entidades de e2e anteriores que no se pueden borrar (no hay
    // `DELETE /api/organizations/{id}/`, por diseño: las entidades no se
    // eliminan). Se deriva del timestamp para que cada corrida sea única.
    const cif = `G${String(now).slice(-8)}`;

    await page.goto("/login");
    await page.getByLabel("Usuario o email").fill(PLATAFORMA_SUPERADMIN_EMAIL);
    await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/plataforma/);

    // Entidades: crear una nueva (nace sin verificar, docs/SEGURIDAD_Y_MODERACION.md §8)
    await page.getByRole("link", { name: "Entidades", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Entidades" })).toBeVisible();

    await page.getByRole("button", { name: "Nueva entidad" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva entidad" });
    await dialog.getByLabel("Nombre").fill(name);
    await dialog.getByLabel("Slug").fill(slug);
    await dialog.getByLabel("CIF").fill(cif);
    await dialog.getByRole("button", { name: "Crear entidad" }).click();
    await expect(dialog.getByText(`Entidad «${name}» creada, sin verificar.`)).toBeVisible();
    // `getByRole("button", { name: "Cerrar" })` es ambiguo: el botón «×» de
    // cerrar el diálogo lleva `aria-label="Cerrar"` (mismo nombre accesible
    // que el botón visible «Cerrar» del formulario) — se distingue por el
    // texto visible, que el «×» no tiene.
    await dialog.locator("button", { hasText: "Cerrar" }).click();

    // Buscarla y entrar en su ficha
    await page.getByLabel("Buscar por nombre").fill(name);
    const entityLink = page.getByRole("link", { name });
    await expect(entityLink).toBeVisible();
    await entityLink.click();

    await expect(page.getByRole("heading", { name: "Ficha de la entidad" })).toBeVisible();
    await expect(page.getByText("Pendiente")).toBeVisible();
    await page.getByRole("button", { name: "Verificar entidad" }).click();
    await expect(page.getByText("Verificada")).toBeVisible();

    // Reportes: cola global, abrir el reporte escalado en `beforeAll`
    await page.getByRole("link", { name: "Reportes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
    await page.getByLabel("Estado").selectOption("");
    // `.first()`: corridas anteriores de este mismo test (local, backend
    // persistente) pueden haber escalado ya otro reporte de Bidasoa —
    // basta con que haya al menos uno.
    await expect(page.getByText("Escalado").first()).toBeVisible();

    const firstDetailLink = page.getByRole("link", { name: "Ver detalle" }).first();
    await expect(firstDetailLink).toBeVisible();
    await firstDetailLink.click();

    // `{ exact: true }`: sin él, "Reporte" empareja por subcadena con la
    // propia «Reportes» de la lista (y "Detalle" con los enlaces «Ver
    // detalle» de esa misma lista) — falso positivo si la navegación no
    // hubiera llegado a ocurrir de verdad.
    await expect(page.getByRole("heading", { name: "Reporte", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Detalle", exact: true })).toBeVisible();
  });
});
