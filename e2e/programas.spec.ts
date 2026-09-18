import { expect, test } from "@playwright/test";

import {
  BIDASOA_SLUG,
  DEMO_PASSWORD,
  TITULAR_BIDASOA_EMAIL,
  expectExportFilename,
} from "./helpers";

/**
 * Titular de Asociación Bidasoa (tarea W5, Fase 6, `docs/PANEL.md` §12):
 * crea un programa, lo activa, lo cierra con notas y descarga su informe
 * final en CSV. Sin fixture por API — a diferencia de la actividad de
 * `titular.spec.ts` (que depende de una ventana horaria real), un
 * programa no tiene esa restricción: fechas fijas de 2026 bastan.
 */
test("titular crea, activa y cierra un programa, y descarga su informe CSV", async ({ page }) => {
  const name = `Programa E2E ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Usuario o email").fill(TITULAR_BIDASOA_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`/entidad/${BIDASOA_SLUG}`));

  await page.getByRole("link", { name: "Programas", exact: true }).click();
  // Espera la navegación real antes de mirar el `<h1>`: el Inicio de la
  // entidad tiene su propia tarjeta «Programas en curso» bajo una región
  // rotulada justo «Programas» (`aria-labelledby`, sr-only) — sin fijar
  // la URL primero, un `getByRole("heading", { name: "Programas" })`
  // puede toparse con las dos mientras la navegación aún no ha ocurrido.
  await expect(page).toHaveURL(new RegExp(`/entidad/${BIDASOA_SLUG}/programas$`));
  await expect(page.getByRole("heading", { name: "Programas", level: 1 })).toBeVisible();

  // Alta
  await page.getByRole("button", { name: "Nuevo programa" }).click();
  const createDialog = page.getByRole("dialog", { name: "Nuevo programa" });
  await createDialog.getByLabel("Nombre").fill(name);
  await createDialog.getByLabel("Financiador").fill("Diputación de prueba E2E");
  await createDialog.getByLabel("Inicio").fill("2026-01-01");
  // `exact: true`: sin él, «Fin» empareja por subcadena con «Financiador»
  // (mismo campo del formulario, «Fin» es prefijo de «Financiador»).
  await createDialog.getByLabel("Fin", { exact: true }).fill("2026-12-31");
  await createDialog.getByLabel("Presupuesto (€)").fill("1000");
  await createDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(createDialog).toBeHidden();

  const programLink = page.getByRole("link", { name });
  await expect(programLink).toBeVisible();
  await programLink.click();

  await expect(page.getByRole("heading", { name: "Ficha del programa" })).toBeVisible();
  await expect(page.getByText("Borrador")).toBeVisible();

  // Activar
  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByText("En curso")).toBeVisible();

  // Cerrar, con notas
  await page.getByRole("button", { name: "Cerrar programa", exact: true }).click();
  const closeDialog = page.getByRole("alertdialog", { name: "Cerrar programa" });
  await closeDialog.getByLabel("Notas de cierre").fill("Cierre de prueba e2e.");
  await closeDialog.getByRole("button", { name: "Cerrar programa" }).click();
  await expect(page.getByText("Cerrado")).toBeVisible();
  await expect(page.getByText("Notas de cierre: Cierre de prueba e2e.")).toBeVisible();

  // Descargar el informe (CSV). El nombre real lo pone
  // `programs/viewsets.py` en `Content-Disposition`
  // (`popyplan-programa-<id>.csv`, docs/PANEL.md §12.4) y el backend ya
  // expone esa cabecera por CORS, así que se comprueba entero; el
  // respaldo (`informe-programa.csv`) lo cubre `expectExportFilename`.
  // `status() === 200` por lo mismo que en `titular.spec.ts`:
  // `fetchWithAuth` reintenta tras refrescar si el access ha caducado.
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/report/") &&
      response.url().includes("format=csv") &&
      response.status() === 200,
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar informe CSV" }).click();
  const download = await downloadPromise;
  const response = await responsePromise;

  expectExportFilename(download, response, {
    pattern: /popyplan-programa-\d+\.csv/,
    fallback: "informe-programa.csv",
  });
});
