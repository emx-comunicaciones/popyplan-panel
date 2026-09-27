import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { mundo } from "./personas";

/**
 * axe sobre las páginas principales de las tres áreas, ya renderizadas con
 * datos reales y con los estilos de verdad (a diferencia de `vitest-axe`,
 * que corre en jsdom): aquí sí se comprueba el contraste (`color-contrast`).
 * Reglas WCAG 2.1 A y AA, como la declaración de `/accesibilidad`.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function sinViolaciones(pagina: Page, ruta: string) {
  await pagina.goto(ruta);
  await pagina.waitForLoadState("networkidle");
  if (ruta !== "/") expect(new URL(pagina.url()).pathname, "se ha perdido la sesión").toBe(ruta);
  await expect(pagina.locator("main")).toBeVisible();
  const { violations } = await new AxeBuilder({ page: pagina }).withTags(WCAG).analyze();
  const resumen = violations.flatMap((v) =>
    v.nodes.map(
      (n) => `${v.id} (${v.impact}): ${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`,
    ),
  );
  expect(resumen, `${ruta}\n${resumen.join("\n")}`).toEqual([]);
}

const entidad = () => `/entidad/${mundo().entidades.asociacion.slug}`;
const paraguas = () => `/paraguas/${mundo().entidades.ayuntamiento.slug}`;

const PAGINAS: [string, () => string[]][] = [
  ["asociacion", () => ["", "/personas", "/actividades", "/comunidades", "/reportes",
    "/comunicaciones", "/configuracion"].map((r) => entidad() + r)],
  ["ayuntamiento", () => ["", "/red-financiada", "/territorio", "/informes"]
    .map((r) => paraguas() + r)],
  ["plataforma", () => ["", "/entidades", "/reportes", "/usuarios", "/auditoria"]
    .map((r) => `/plataforma${r}`)],
];

for (const [clave, rutas] of PAGINAS) {
  test(`${clave}: sus páginas principales no tienen violaciones de axe`, async ({ como }) => {
    const pagina = await como(clave);
    for (const ruta of rutas()) {
      await test.step(ruta, () => sinViolaciones(pagina, ruta));
    }
  });
}

test("login y landing, sin sesión, no tienen violaciones de axe", async ({ browser }) => {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();
  for (const ruta of ["/", "/login", "/accesibilidad"]) {
    await test.step(ruta, () => sinViolaciones(pagina, ruta));
  }
  await contexto.close();
});
