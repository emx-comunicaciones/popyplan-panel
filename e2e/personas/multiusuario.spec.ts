import type { Page } from "@playwright/test";

import { reporteNuevoEnLaAsociacion } from "./api";
import { expect, test } from "./fixtures";
import { mundo } from "./personas";

/**
 * Varios personajes a la vez, cada uno en su propio navegador (contexto):
 *
 * 1. Ayuntamiento y moderadora en paralelo: cada uno ve solo lo suyo, y la
 *    URL del área del otro no le abre nada.
 * 2. Lo que hace una se ve en la otra:
 *    - la moderadora crea una comunidad con el sello de la asociación y el
 *      ayuntamiento ve subir «Comunidades activas» de su territorio (la
 *      sede de la asociación está en su municipio). Es la métrica que
 *      cambia al momento: las actividades solo cuentan una vez celebradas
 *      (`panel.services.metrics._celebrados`) y el backend exige crearlas
 *      en el futuro;
 *    - la moderadora resuelve un reporte y la titular lo ve salir de los
 *      pendientes de la cola de su entidad.
 */
const asociacion = () => mundo().entidades.asociacion;

/** Navega y espera a que la pantalla termine de cargar, como una persona:
 *  el arranque del cliente rota el refresh, y navegar otra vez con esa
 *  petición en vuelo cierra la sesión (deuda conocida del panel: sin caché
 *  de rotación compartida entre el middleware y el route handler). */
async function ir(pagina: Page, ruta: string) {
  await pagina.goto(ruta);
  await pagina.waitForLoadState("networkidle");
}

const ayuntamiento = () => mundo().entidades.ayuntamiento;

test("ayuntamiento y moderadora a la vez: cada uno solo ve lo suyo", async ({ como }) => {
  const [jon, maite] = await Promise.all([como("ayuntamiento"), como("moderadora")]);
  await Promise.all([
    ir(jon, `/paraguas/${ayuntamiento().slug}`),
    ir(maite, `/entidad/${asociacion().slug}`),
  ]);
  await expect(jon.getByRole("navigation").getByRole("link", { name: "Red financiada" }))
    .toBeVisible();
  await expect(maite.getByRole("navigation").getByRole("link", { name: "Reportes" }))
    .toBeVisible();

  // Cada uno prueba la URL del área del otro: vuelve a la suya.
  await Promise.all([
    ir(jon, `/entidad/${asociacion().slug}/personas`),
    ir(maite, `/paraguas/${ayuntamiento().slug}/red-financiada`),
  ]);
  await expect(jon).toHaveURL(new RegExp(`/paraguas/${ayuntamiento().slug}`));
  await expect(maite).toHaveURL(new RegExp(`/entidad/${asociacion().slug}`));
  await expect(jon.getByText(/Vecina 0\d/)).toHaveCount(0);
});

async function comunidadesActivas(pagina: Page): Promise<number> {
  const valor = pagina
    .locator("dl", { has: pagina.locator("dt", { hasText: "Comunidades activas" }) })
    .first()
    .locator("dd");
  await expect(valor).not.toHaveText("");
  return Number((await valor.innerText()).replace(/\D/g, ""));
}

test("la moderadora crea una comunidad y el ayuntamiento la ve en su territorio", async ({
  como,
}) => {
  const [jon, maite] = await Promise.all([como("ayuntamiento"), como("moderadora")]);
  await ir(jon, `/paraguas/${ayuntamiento().slug}`);
  const antes = await comunidadesActivas(jon);

  await ir(maite, `/entidad/${asociacion().slug}/comunidades`);
  await maite.getByRole("button", { name: "Nueva comunidad" }).click();
  const nombre = `Taller de pruebas ${Date.now()}`;
  const dialogo = maite.getByRole("dialog");
  await dialogo.getByLabel("Nombre").fill(nombre);
  await dialogo.getByRole("button", { name: "Crear comunidad" }).click();
  await expect(dialogo).toBeHidden();
  await expect(maite.getByText(nombre).first()).toBeVisible();

  await jon.reload();
  await jon.waitForLoadState("networkidle");
  await expect.poll(() => comunidadesActivas(jon)).toBe(antes + 1);
});

test("la moderadora resuelve un reporte y la titular lo ve salir de pendientes", async ({
  como,
}) => {
  const texto = `Publicación reportada ${Date.now()}`;
  const reporte = await reporteNuevoEnLaAsociacion(texto);
  const [nerea, maite] = await Promise.all([como("asociacion"), como("moderadora")]);
  const cola = `/entidad/${asociacion().slug}/reportes`;

  await ir(nerea, cola);
  const fila = nerea.locator(`a[href$="/reportes/${reporte}"]`);
  await expect(fila).toBeVisible();

  await ir(maite, `${cola}/${reporte}`);
  await maite.locator("#reporte-resolucion").selectOption("dismissed");
  await maite.locator("#reporte-nota").fill("Revisado: no incumple las normas.");
  await maite.getByRole("button", { name: "Resolver" }).click();
  await expect(maite.getByText("Resuelto")).toBeVisible();

  await nerea.reload();
  await nerea.waitForLoadState("networkidle");
  await expect(nerea.locator(`a[href$="/reportes/${reporte}"]`)).toHaveCount(0);
});
