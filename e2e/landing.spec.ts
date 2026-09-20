import { expect, test } from "@playwright/test";

import {
  BIDASOA_SLUG,
  DEMO_PASSWORD,
  DEMO_PERSON_EMAIL,
  TITULAR_BIDASOA_EMAIL,
} from "./helpers";

/**
 * Landing pública y login único (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §7), contra el backend real
 * sembrado con `seed_panel_demo`.
 *
 * Dos logins de UI en todo el fichero (límite de 5/60 s por IP en local,
 * `users/rate_limiting.py`; `pop.settings_e2e` lo desactiva en CI) y
 * ninguno de API: la navegación es toda por clic.
 *
 * `DEMO_PERSON_EMAIL` (`panel-demo-asociacion-bidasoa-p01@test.com`) es
 * una de las veinte personas «de calle» de la demo: participa en
 * actividades de Bidasoa, pero ninguno de los cinco roles con panel
 * (`lib/auth/area.ts::ENTIDAD_PANEL_ROLES`) es el suyo, así que
 * `resolveArea` la resuelve a `sin-acceso` — es justo la cuenta que tiene
 * que ver «Tu cuenta es de la app».
 *
 * `exact: true` en el enlace «Entrar» de la landing: el `name` de
 * `getByRole` de Playwright empareja por subcadena por defecto, y la
 * portada tiene además «Entrar al panel» — sin `exact` serían dos
 * coincidencias y el modo estricto lo rechazaría.
 */
test("sin sesión, la raíz muestra la landing y «Entrar» lleva al login", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Planes, comunidades y actividades para vivir bien acompañado",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Asociaciones y ONG" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("una cuenta sin rol de panel ve «Tu cuenta es de la app»", async ({
  page,
  baseURL,
}) => {
  await page.goto("/login");

  await page.getByLabel("Usuario o email").fill(DEMO_PERSON_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  // La raíz exacta, no «cualquier URL acabada en barra» (M13): un
  // `/elegir-entidad/` inesperado casaba con `/\/$/` y el test seguía
  // verde hasta la aserción siguiente.
  // Raíz exacta del sitio: se compara el `pathname` en vez de interpolar
  // `baseURL` en una expresión regular (sus puntos casarían con cualquier
  // carácter).
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  expect(page.url().startsWith(baseURL ?? "")).toBe(true);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Tu cuenta es de la app Popyplan",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
});

test("con sesión de titular, visitar la raíz aterriza en su entidad", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByLabel("Usuario o email").fill(TITULAR_BIDASOA_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(new RegExp(`/entidad/${BIDASOA_SLUG}`));

  // La raíz ya no es una pantalla de paso: con sesión reparte por área,
  // igual que antes de la landing (hallazgo A2).
  await page.goto("/");

  await expect(page).toHaveURL(new RegExp(`/entidad/${BIDASOA_SLUG}`));
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
});
