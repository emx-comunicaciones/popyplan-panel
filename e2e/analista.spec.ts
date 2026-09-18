import { expect, test } from "@playwright/test";

import { ANALISTA_GFA_EMAIL, DEMO_PASSWORD } from "./helpers";

/**
 * Analista de la diputación (Gipuzkoako Foru Aldundia, entidad paraguas
 * — tarea W6): login → métricas del paraguas → exportar PDF.
 *
 * El hueco de contrato que documentaba este test («`org_memberships` no
 * dice el tipo de organización») **está cerrado**: el serializer expone
 * `organization_type` y `lib/auth/area.ts::isParaguas` lo mira, así que
 * el login de `panel-analista-gfa@test.com` resuelve al área de paraguas
 * por su cuenta. La aserción de URL admite las dos formas y el
 * `page.goto('/paraguas/...')` se mantiene a propósito: el gate de la
 * página solo mira membresía + rol, así que el flujo bajo prueba (las
 * métricas agregadas y su exportación) queda fijado incluso si un
 * backend anterior al cambio devolviera el área de entidad.
 *
 * El PDF depende de WeasyPrint (`docs/PANEL.md` §2.3): si el entorno no
 * tiene sus librerías nativas, el backend responde 503 y el panel
 * muestra el mensaje del contrato — este test lo trata como un salto
 * documentado (`test.skip` dinámico), no como un fallo.
 */
test("analista GFA: métricas del paraguas y exportar PDF", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuario o email").fill(ANALISTA_GFA_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Aterriza en /paraguas/gipuzkoako-foru-aldundia (ver docstring); la
  // navegación explícita deja el test independiente de esa resolución.
  await expect(page).toHaveURL(/\/(entidad|paraguas)\/gipuzkoako-foru-aldundia/);
  await page.goto("/paraguas/gipuzkoako-foru-aldundia");

  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  // Tarjetas de métricas agregadas (docs/PANEL.md §1.4): al menos
  // «Personas activas» y «Asistencia» deben pintarse con datos o «<5».
  // `{ exact: true }` en las dos: son los `<dt>` de sendas `StatCard`, y
  // sin él «Asistencia» empareja por subcadena (Playwright no distingue
  // mayúsculas con una cadena) con las tres cabeceras «% asistencia
  // (actual/anterior/Δ)» de la `ComparativaTable` de la misma página, que
  // rompen el modo estricto del localizador.
  await expect(page.getByText("Personas activas", { exact: true })).toBeVisible();
  await expect(page.getByText("Asistencia", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Informes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Informes" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 }).catch(() => null);
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  const download = await downloadPromise;

  if (!download) {
    await expect(page.locator('[role="alert"]').filter({ hasText: "PDF" })).toContainText(
      /PDF no está disponible/,
    );
    test.skip(
      true,
      "WeasyPrint no disponible en este entorno (503, docs/PANEL.md §2.3) — salto documentado, no es un fallo del flujo.",
    );
    return;
  }

  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
});
