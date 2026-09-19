import { expect, test } from "@playwright/test";

import { apiLogin, DEMO_PASSWORD, newApiContext, TITULAR_BIDASOA_EMAIL } from "./helpers";

/**
 * Selector de idioma (spec de diseño `2026-09-19-i18n-es-eu-ca`, tarea 6
 * del plan de i18n del panel): en `/login`, cambiar a euskera antes de
 * entrar; tras entrar, la cabecera y el menú de la entidad siguen en
 * euskera; volver a español desde dentro del panel.
 *
 * **Reinicio de `preferred_language` antes del test (1 login de API +
 * 1 de UI, dentro del límite de 5/60s/IP)**: la decisión 2 del diseño
 * dice que «la cuenta manda al entrar» — `hooks/useAuth.ts
 * ::applyAccountLanguage` sobrescribe la cookie con el idioma guardado
 * en la cuenta si lo hay, **incluso si acabas de elegir otro idioma en
 * la propia pantalla de login**. El backend local persiste entre
 * ejecuciones (no es SQLite efímero como en CI): la primera vez que
 * este mismo spec pasó de verdad, el paso final («volver a ES» estando
 * ya autenticado) guardó `preferred_language: "es"` en la cuenta de
 * titular Bidasoa a través de `PATCH .../update_profile/` — y esa
 * escritura real dejó el euskera elegido en `/login` inutilizable en
 * cuanto se completaba el login, porque `applyAccountLanguage` lo
 * revertía a «es» acto seguido. Sin este reinicio, el spec sería
 * determinista solo la primera vez que se ejecuta contra un backend
 * limpio. `preferred_language: ""` dentro del propio spec (paso 2, con
 * sesión) vuelve a dejarlo en «es» al terminar, así que las
 * repeticiones futuras necesitan el mismo reinicio — es un efecto
 * secundario esperado de probar una función que persiste de verdad.
 *
 * El código de dos letras del botón (`ES`/`EU`/`CA`) es literal en los
 * tres idiomas (`lang.toUpperCase()`, nunca traducido) — a diferencia
 * del `aria-label` (nombre completo del idioma), que sí cambia con el
 * idioma activo (`language.es` es «Español» en español pero «Gaztelania»
 * en euskera). Por eso los botones se localizan por su texto visible
 * exacto, no por accessible name.
 */
test.beforeAll(async () => {
  const api = await newApiContext();
  try {
    const token = await apiLogin(api, TITULAR_BIDASOA_EMAIL);
    await api.patch("/api/users/users/update_profile/", {
      headers: { Authorization: `Bearer ${token}` },
      data: { preferred_language: "" },
    });
  } finally {
    await api.dispose();
  }
});

test("cambiar a euskera en el login, entrar y ver el panel en euskera, y volver a español", async ({
  page,
}) => {
  await page.goto("/login");

  await page.locator('button:text-is("EU")').click();

  // El botón de entrar cambia a euskera (`auth.login.submit` = «Sartu»).
  await expect(page.getByRole("button", { name: "Sartu" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "eu");

  await page.getByLabel("Erabiltzailea edo emaila").fill(TITULAR_BIDASOA_EMAIL);
  await page.getByLabel("Pasahitza").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sartu" }).click();

  await expect(page).toHaveURL(/\/entidad\//);
  await expect(page.locator("html")).toHaveAttribute("lang", "eu");
  // Cabecera (`entidad.inicio.heading` = «Hasiera»), menú
  // (`menu.entidad.personas` = «Pertsonak») y «Cerrar sesión»
  // (`auth.logout.action` = «Saioa itxi») en euskera, sin recargar la
  // página a mano: el `router.refresh()` del selector ya la dejó así al
  // pulsar «EU» en `/login`.
  await expect(page.getByRole("heading", { name: "Hasiera" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pertsonak" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Saioa itxi" })).toBeVisible();

  await page.locator('button:text-is("ES")').click();

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Personas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
});
