import { expect, test } from "@playwright/test";

import { ANALISTA_GFA_EMAIL, DEMO_PASSWORD } from "./helpers";

/**
 * Analista de la diputación (Gipuzkoako Foru Aldundia, entidad paraguas
 * — tarea W6): login → métricas del paraguas → exportar PDF.
 *
 * **Hueco de contrato real, verificado en esta tarea** (`CLAUDE.md`
 * «Regla de paraguas»): `GET /api/users/users/me/` sigue sin exponer
 * `org_type` en `org_memberships` (comprobado a mano contra el backend
 * seedeado), así que `resolveArea` no puede distinguir esta membresía
 * como paraguas y el login de `panel-analista-gfa@test.com` aterriza en
 * `/entidad/gipuzkoako-foru-aldundia`, no en `/paraguas/...` — la propia
 * entidad paraguas no tiene eventos propios (todos cuelgan de sus
 * entidades hijas), así que esa vista de entidad sale casi vacía. La
 * página de paraguas (`app/paraguas/[slug]/layout.tsx`) sí es alcanzable
 * y funciona para esta cuenta si se navega a ella directamente (el gate
 * solo mira `org_memberships` + rol, no `org_type`): este test navega
 * ahí a propósito para ejercer el flujo real que pide la tarea, en vez
 * de depender de una redirección automática que hoy no ocurre.
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

  // Aterriza en /entidad/gipuzkoako-foru-aldundia (ver docstring); se
  // navega a propósito a la vista de paraguas de la misma entidad.
  await expect(page).toHaveURL(/\/(entidad|paraguas)\/gipuzkoako-foru-aldundia/);
  await page.goto("/paraguas/gipuzkoako-foru-aldundia");

  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  // Tarjetas de métricas agregadas (docs/PANEL.md §1.4): al menos
  // «Personas activas» y «Asistencia» deben pintarse con datos o «<5».
  await expect(page.getByText("Personas activas")).toBeVisible();
  await expect(page.getByText("Asistencia")).toBeVisible();

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
