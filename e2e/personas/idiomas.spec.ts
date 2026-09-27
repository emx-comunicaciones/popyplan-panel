import type { BrowserContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { mundo } from "./personas";

/**
 * Ninguna clave de traducción falta al pintar de verdad las pantallas en
 * es, eu y ca. `lib/i18n/messages.test.ts` ya fija que los cuatro
 * catálogos tienen las mismas claves; esto comprueba lo que ese test no
 * ve: una clave que se usa en el código y no existe en ningún catálogo, o
 * una construida mal. next-intl pinta entonces la ruta de la clave
 * (`entidad.algo.titulo`) y avisa por consola con `MISSING_MESSAGE`.
 *
 * El idioma se cambia con la cookie `pp_lang`, que es lo que hace el
 * selector (`lib/i18n/cookie.ts`); al final se deja en `es`.
 */
const IDIOMAS = ["es", "eu", "ca"] as const;
const NAMESPACES = ["common", "menu", "pages", "entidad", "paraguas", "plataforma", "metrics",
  "errors", "help", "auth", "landing", "accessibility"];
const CLAVE_CRUDA = new RegExp(`\\b(?:${NAMESPACES.join("|")})\\.[a-z][A-Za-z0-9]*(?:\\.[A-Za-z0-9]+)+\\b`);

async function fijarIdioma(contexto: BrowserContext, baseURL: string, idioma: string) {
  await contexto.addCookies([{ name: "pp_lang", value: idioma, url: baseURL }]);
}

async function sinClavesSueltas(pagina: Page, ruta: string, idioma: string) {
  const avisos: string[] = [];
  const escucha = (m: import("@playwright/test").ConsoleMessage) => {
    if (/MISSING_MESSAGE|INVALID_MESSAGE|FORMATTING_ERROR/.test(m.text())) avisos.push(m.text());
  };
  pagina.on("console", escucha);
  await pagina.goto(ruta);
  await pagina.waitForLoadState("networkidle");
  // Sin sesión, `/login` tampoco tiene claves sueltas: sin esta comprobación
  // el test pasaría en verde sin haber visto la pantalla.
  expect(new URL(pagina.url()).pathname, `${idioma}: se ha perdido la sesión`).toBe(ruta);
  await expect(pagina.locator("html")).toHaveAttribute("lang", idioma);
  const texto = await pagina.locator("body").innerText();
  pagina.off("console", escucha);
  const cruda = CLAVE_CRUDA.exec(texto);
  expect(cruda?.[0] ?? null, `${idioma} ${ruta}: clave sin traducir`).toBeNull();
  expect(avisos, `${idioma} ${ruta}`).toEqual([]);
}

const RUTAS: [string, () => string[]][] = [
  ["asociacion", () => ["", "/personas", "/actividades", "/comunidades", "/reportes",
    "/comunicaciones", "/programas", "/configuracion"]
    .map((r) => `/entidad/${mundo().entidades.asociacion.slug}${r}`)],
  ["ayuntamiento", () => ["", "/red-financiada", "/territorio", "/informes"]
    .map((r) => `/paraguas/${mundo().entidades.ayuntamiento.slug}${r}`)],
  ["plataforma", () => ["", "/entidades", "/reportes", "/usuarios", "/nomencladores",
    "/suscripciones"].map((r) => `/plataforma${r}`)],
];

for (const idioma of IDIOMAS) {
  for (const [clave, rutas] of RUTAS) {
    test(`${idioma} · ${clave}: ninguna clave sin traducir`, async ({ como, baseURL }) => {
      const pagina = await como(clave);
      await fijarIdioma(pagina.context(), baseURL!, idioma);
      try {
        for (const ruta of rutas()) {
          await test.step(ruta, () => sinClavesSueltas(pagina, ruta, idioma));
        }
      } finally {
        await fijarIdioma(pagina.context(), baseURL!, "es");
      }
    });
  }
}
