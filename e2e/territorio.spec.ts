import { expect, test } from "@playwright/test";

import { ANALISTA_GFA_EMAIL, DEMO_PASSWORD, GFA_SLUG } from "./helpers";

/**
 * Analista de la diputación (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §5, «E2E»): abre
 * Territorio, ve la tabla por municipio con alguna celda suprimida y
 * abre la ficha de un municipio.
 *
 * Igual que `analista.spec.ts` y `comparativa.spec.ts`, se navega a la
 * vista de administración a propósito en vez de depender de la
 * resolución de área del login: el gate de la página solo mira membresía
 * y rol, así que el flujo bajo prueba queda fijado sin depender de que
 * el backend desplegado ya sirva `is_administration`.
 *
 * **Un solo login de UI**, sin ninguna llamada de API: el límite del
 * backend es de 5 intentos por 60 s y por IP
 * (`users/rate_limiting.py`), compartido con el resto de la suite.
 *
 * El preset por defecto («Este mes») no tiene volumen suficiente en la
 * demo sembrada para que la comparativa devuelva filas (mismo motivo
 * documentado en `comparativa.spec.ts`), así que el spec cambia a «Año»
 * antes de comprobar la tabla.
 */
test("analista de la diputación ve el territorio y la ficha de un municipio", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuario o email").fill(ANALISTA_GFA_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`/(entidad|paraguas)/${GFA_SLUG}`));

  await page.goto(`/paraguas/${GFA_SLUG}`);
  await page.getByRole("link", { name: "Territorio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Territorio", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Año", exact: true }).click();

  // El mapa es `role="img"`: su contenido no es la alternativa accesible,
  // la tabla sí — se comprueban los dos.
  await expect(page.getByRole("img", { name: /^Mapa del territorio:/ })).toBeVisible();

  const tabla = page.locator('section[aria-labelledby="territorio-tabla-heading"]');
  await expect(tabla.locator("table")).toBeVisible();
  await expect(tabla.getByText(/^(<5|—)$/).first()).toBeVisible();

  await tabla.getByRole("button", { name: "Ver ficha" }).first().click();

  const ficha = page.getByRole("dialog");
  await expect(ficha.getByText("Actividades celebradas")).toBeVisible();
  await expect(ficha.getByText("Entidades con sede aquí", { exact: true })).toBeVisible();
  // Invariante 1: la ficha nunca nombra entidades ni personas.
  await expect(
    ficha.getByText("Esta ficha solo muestra agregados: nunca nombres de personas ni de las entidades con sede aquí."),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(`/paraguas/${GFA_SLUG}/red-financiada`);
  await expect(page.getByRole("heading", { name: "Red financiada", level: 1 })).toBeVisible();
});
