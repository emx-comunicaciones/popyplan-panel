import { expect, test, type APIRequestContext } from "@playwright/test";

import {
  BIDASOA_SLUG,
  DEMO_PASSWORD,
  ELKARTEA_TXIKIA_SLUG,
  REFERENTE_BIDASOA_EMAIL,
  SUPPORTER_1_EMAIL,
  TITULAR_BIDASOA_EMAIL,
  TITULAR_TXIKIA_EMAIL,
  apiLogin,
  newApiContext,
  resolvePublicName,
} from "./helpers";

/**
 * Red de apoyo en el panel de entidad (`docs/PANEL.md` §14.5-14.6,
 * Fase 7): (a) el referente de Asociación Bidasoa ve «Red de apoyo» en
 * la ficha de «Persona 01», con el `public_name` real del primer apoyo
 * de su red (nunca «Miren» a mano — ese nombre es solo el ejemplo
 * ilustrativo de PANEL.md §14.5, la demo real siembra «Apoyo `NN`»);
 * (b) el titular de la misma entidad no ve esa sección en la misma
 * ficha (no es el referente asignado); (c) el titular de «Elkartea
 * Txikia» —sembrada a propósito sin comunidad de familias— ve en
 * Familias el aviso de un apoyo a la espera y el botón «Nueva comunidad
 * de familias».
 *
 * Solo **4 logins** en todo el fichero (límite de 5/min/IP en local,
 * `pop.settings_e2e` lo desactiva en CI): uno de API
 * (`SUPPORTER_1_EMAIL`, para leer su `public_name` sin darlo por
 * sabido) y tres de UI (uno por test). Ningún id se resuelve por API —
 * toda la navegación es por clic (Personas → «Persona 01», igual que
 * `e2e/titular.spec.ts`), así el test no depende de conocer el id
 * numérico de nadie.
 */
test.describe("Red de apoyo", () => {
  let api: APIRequestContext;
  let apoyo1Name: string;

  test.beforeAll(async () => {
    api = await newApiContext();
    const apoyoToken = await apiLogin(api, SUPPORTER_1_EMAIL);
    apoyo1Name = await resolvePublicName(api, apoyoToken);
  });

  test.afterAll(async () => {
    if (api) await api.dispose();
  });

  test("referente de Bidasoa ve la red de apoyo de Persona 01", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Usuario o email").fill(REFERENTE_BIDASOA_EMAIL);
    await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(new RegExp(`/entidad/${BIDASOA_SLUG}`));

    await page.getByRole("link", { name: "Personas", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Personas" })).toBeVisible();
    await page.getByRole("link", { name: "Persona 01" }).click();
    await expect(page.getByRole("heading", { name: "Ficha de la persona" })).toBeVisible();

    const supportSection = page.locator('section[aria-labelledby="red-apoyo-heading"]');
    await expect(supportSection.getByRole("heading", { name: "Red de apoyo" })).toBeVisible();
    // El nombre viene de la API (`apoyo1Name`), nunca hardcodeado: es la
    // única forma de comprobar el dato real sin darlo por sabido.
    await expect(supportSection.getByText(apoyo1Name, { exact: false })).toBeVisible();
    await expect(
      supportSection.getByText(
        "Solo tú, como referente, ves esta red. Popyplan no guarda teléfonos: contacta con la persona por el chat de la app.",
      ),
    ).toBeVisible();
    // Invariante 9: nunca contacto — ni un email en toda la sección.
    await expect(supportSection).not.toContainText("@");
  });

  test("titular de Bidasoa no ve la red de apoyo en la misma ficha", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Usuario o email").fill(TITULAR_BIDASOA_EMAIL);
    await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(new RegExp(`/entidad/${BIDASOA_SLUG}`));

    await page.getByRole("link", { name: "Personas", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Personas" })).toBeVisible();
    await page.getByRole("link", { name: "Persona 01" }).click();
    await expect(page.getByRole("heading", { name: "Ficha de la persona" })).toBeVisible();

    // El titular sí tiene acceso a la ficha (no es un 404/403 de página);
    // la sección «Red de apoyo» sencillamente no se monta porque no es
    // el referente asignado a esta persona (`isReferent`, `docs/PANEL.md`
    // §14.5) — ni cabecera ni mensaje, revelar que existe ya sería un dato.
    await expect(page.getByRole("heading", { name: "Red de apoyo" })).toHaveCount(0);
    await expect(page.locator('section[aria-labelledby="red-apoyo-heading"]')).toHaveCount(0);
  });

  test("Elkartea Txikia avisa del apoyo a la espera de la comunidad de familias", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Usuario o email").fill(TITULAR_TXIKIA_EMAIL);
    await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(new RegExp(`/entidad/${ELKARTEA_TXIKIA_SLUG}`));

    await page.getByRole("link", { name: "Familias", exact: true }).click();
    // `{ exact: true }`: sin él, «Familias» empareja por subcadena (sin
    // distinguir mayúsculas) con «Resumen de Familias» y «Comunidades de
    // familias», los dos `<h2>` de la propia página.
    await expect(page.getByRole("heading", { name: "Familias", exact: true })).toBeVisible();

    // Elkartea Txikia se siembra a propósito sin comunidad de familias
    // (docs/PANEL.md §14.6), con un apoyo (`panel-demo-apoyo-04`) a la
    // espera de que se cree: singular, `missing_families_space_supporters
    // === 1`.
    await expect(
      page.getByText(
        "1 persona de la red de apoyo espera a que crees la comunidad de familias.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Nueva comunidad de familias" }),
    ).toBeVisible();
  });
});
