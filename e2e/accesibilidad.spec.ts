import { expect, test, type Page } from "@playwright/test";

/**
 * Accesibilidad (tarea W5, Fase 6): dos flujos independientes, ninguno
 * necesita sesión — no hay `beforeAll`/fixture por API aquí.
 */

/**
 * Comprueba que `document.activeElement` lleva el anillo de foco global
 * (`app/globals.css::focus-visible`, `outline: 3px solid
 * var(--color-primary-700)`) — no basta con que el elemento correcto
 * tenga el foco lógico (`toBeFocused()`), la declaración de
 * accesibilidad promete que el foco además se ve.
 */
async function expectVisibleFocusRing(page: Page): Promise<void> {
  const hasVisibleOutline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
  });
  expect(hasVisibleOutline).toBe(true);
}

test("la declaración de accesibilidad es pública, sin sesión", async ({ page }) => {
  await page.goto("/accesibilidad");

  // Sin sesión, `AccesibilidadPage` es un Server Component sin
  // `getServerSession` — no debe redirigir a /login.
  await expect(page).toHaveURL(/\/accesibilidad$/);
  await expect(
    page.getByRole("heading", { name: "Declaración de accesibilidad de Popyplan" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Situación de cumplimiento" })).toBeVisible();
});

test("en /login, Tab recorre idioma → email → contraseña → botón, siempre con el foco visible", async ({
  page,
}) => {
  await page.goto("/login");

  // Sin `SkipLink` en esta página (solo la llevan los tres layouts de
  // área): el primer Tab desde la carga de la página cae en el primer
  // elemento interactivo del propio formulario de login. Desde la tarea
  // 6 de i18n eso ya no es el campo de usuario, sino el selector de
  // idioma (`components/layout/LanguageSwitcher.tsx`), colocado antes
  // del formulario a propósito: alguien que solo use el teclado también
  // tiene que poder cambiar de idioma antes de rellenar sus
  // credenciales, no solo quien usa el ratón. Desde la pasada de
  // densidad (2026-09-20) el selector es un único `<select>`, así que
  // ocupa una sola parada de tabulación en vez de tres.
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Idioma")).toBeFocused();
  await expectVisibleFocusRing(page);

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Usuario o email")).toBeFocused();
  await expectVisibleFocusRing(page);

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Contraseña")).toBeFocused();
  await expectVisibleFocusRing(page);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeFocused();
  await expectVisibleFocusRing(page);
});
