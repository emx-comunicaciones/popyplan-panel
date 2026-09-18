import { expect, test, type APIRequestContext } from "@playwright/test";

import {
  BIDASOA_SLUG,
  DEMO_PASSWORD,
  TITULAR_BIDASOA_EMAIL,
  apiLogin,
  createCheckinFixture,
  expectExportFilename,
  newApiContext,
  resolveOrgId,
  type CheckinFixture,
} from "./helpers";

/**
 * Flujo completo del titular de «Asociación Bidasoa» (tarea W6): login →
 * Inicio → Personas → ficha → Asistencia (marcar asistencia a mano y
 * check-in por QR con el token real de `my-checkin/`) → Informes
 * (descarga CSV). La actividad y las dos inscripciones se crean por API
 * en `beforeAll` (`e2e/helpers.ts::createCheckinFixture` — necesario
 * porque la ventana de check-in de la demo sembrada ya está cerrada
 * salvo que la actividad se cree con `starts_at` a un par de minutos
 * vista) y se borran en `afterAll`.
 */
test.describe("Titular de Asociación Bidasoa", () => {
  let api: APIRequestContext;
  let orgId: number;
  let fixture: CheckinFixture;

  test.beforeAll(async () => {
    api = await newApiContext();
    const titularToken = await apiLogin(api, TITULAR_BIDASOA_EMAIL);
    orgId = await resolveOrgId(api, titularToken, BIDASOA_SLUG);
    fixture = await createCheckinFixture(api, titularToken, orgId);
  });

  test.afterAll(async () => {
    // Defensivo: si `beforeAll` falló a medias (p. ej. 429 del límite de
    // login), `fixture`/`api` pueden no existir — no hace falta un
    // segundo error confuso encima del real.
    if (fixture) await fixture.cleanup();
    if (api) await api.dispose();
  });

  test("login → Inicio → Personas → ficha → Asistencia → Informes", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Usuario o email").fill(TITULAR_BIDASOA_EMAIL);
    await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(new RegExp(`/entidad/${BIDASOA_SLUG}`));
    await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();

    // Personas → ficha
    await page.getByRole("link", { name: "Personas", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Personas" })).toBeVisible();
    await page.getByRole("link", { name: "Persona 01" }).click();
    await expect(page.getByRole("heading", { name: "Ficha de la persona" })).toBeVisible();
    await expect(page.getByText("Persona 01", { exact: true }).first()).toBeVisible();

    // Asistencia: entrar en la actividad de fixture
    await page.getByRole("link", { name: "Asistencia", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Asistencia" })).toBeVisible();
    await page.getByRole("link", { name: fixture.eventTitle }).click();
    await expect(page.getByRole("heading", { name: "Asistencia" })).toBeVisible();

    // Marcar a la segunda persona (inscrita) como asistida — `mark_attendance`
    // exige que la actividad ya haya empezado (`docs/PANEL.md` §4.3): con un
    // navegador rápido, el flujo de arriba (login, Personas, ficha,
    // Asistencia) puede completarse antes de que pase el margen de
    // `createCheckinFixture` (10s desde la creación) — se espera lo que
    // haga falta para no depender de la velocidad del navegador.
    const msUntilStart = new Date(fixture.startsAt).getTime() - Date.now();
    if (msUntilStart > 0) {
      await page.waitForTimeout(msUntilStart + 1000);
    }

    const attendeeRow = page.locator("tr", { hasText: fixture.secondPersonName });
    await attendeeRow.getByRole("button", { name: "Marcar asistió" }).click();
    // `{ exact: true }`: sin él, «Asistió» empareja por subcadena (sin
    // distinguir mayúsculas) con los propios botones «Marcar asistió»/
    // «Marcar no asistió» de la misma fila.
    await expect(attendeeRow.getByText("Asistió", { exact: true })).toBeVisible();

    // Check-in por QR con el token real de la primera persona
    await page.getByLabel("Token").fill(fixture.token);
    await page.getByRole("button", { name: "Dar entrada" }).click();
    await expect(page.getByText("Check-in correcto.")).toBeVisible();

    // Informes: exportar CSV.
    await page.getByRole("link", { name: "Informes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Informes" })).toBeVisible();

    // El hueco de CORS que este e2e descubrió en la tarea W6 está
    // cerrado: `pop/settings.py` declara
    // `CORS_EXPOSE_HEADERS = ['Content-Disposition']`, así que el panel
    // puede leer el nombre real que manda `panel/viewsets.py`
    // (`popyplan-<slug>-<since>-<until>.csv`, docs/PANEL.md §2.2). Se
    // comprueba entero, no solo la extensión; `expectExportFilename`
    // guarda el respaldo para un backend anterior al cambio.
    // `status() === 200`: `fetchWithAuth` puede refrescar y reintentar
    // ante un 401, y aquí interesa la respuesta que trae el fichero.
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/export/") &&
        response.url().includes("format=csv") &&
        response.status() === 200,
    );
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar CSV" }).click();
    const download = await downloadPromise;
    const response = await responsePromise;

    expectExportFilename(download, response, {
      pattern: new RegExp(`popyplan-${BIDASOA_SLUG}-\\d{4}-\\d{2}-\\d{2}-\\d{4}-\\d{2}-\\d{2}\\.csv`),
      fallback: "informe.csv",
    });
  });
});
