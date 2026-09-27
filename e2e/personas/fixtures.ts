import { test as base, type BrowserContext, type Page } from "@playwright/test";

import { rutaSesion } from "./personas";

/**
 * `como(clave)` abre una pestaña con la sesión de ese personaje.
 *
 * Los contextos son **de worker** y se reutilizan entre tests: el refresh
 * de `pp_session` rota en cada uso, así que un contexto nuevo por test
 * cargado del mismo `storageState` llegaría con un refresh ya gastado y
 * acabaría en `/login`. Uno vivo por personaje va guardando la cookie
 * rotada, como el navegador de una persona de verdad. Varios personajes a
 * la vez en un mismo test = varios contextos abiertos a la vez.
 */
type Como = (clave: string) => Promise<Page>;

async function guardarSesiones(contextos: Map<string, BrowserContext>) {
  await Promise.all(
    [...contextos.entries()].map(([clave, c]) => c.storageState({ path: rutaSesion(clave) })),
  );
}

export const test = base.extend<{ como: Como }, { contextos: Map<string, BrowserContext> }>({
  contextos: [
    // `usar` y no `use`: la regla de hooks de React lo tomaría por `use()`.
    async ({}, usar) => {
      const contextos = new Map<string, BrowserContext>();
      await usar(contextos);
      await guardarSesiones(contextos);
      await Promise.all([...contextos.values()].map((c) => c.close()));
    },
    { scope: "worker" },
  ],
  como: async ({ browser, contextos, baseURL }, usar) => {
    const abiertas: Page[] = [];
    await usar(async (clave) => {
      let contexto = contextos.get(clave);
      if (!contexto) {
        contexto = await browser.newContext({ storageState: rutaSesion(clave), baseURL });
        contextos.set(clave, contexto);
      }
      const pagina = await contexto.newPage();
      abiertas.push(pagina);
      return pagina;
    });
    // Antes de cerrar, que termine lo que haya en vuelo: el arranque del
    // cliente rota el refresh (`POST /api/session/refresh`) y, si la pestaña
    // se cierra antes de la respuesta, el backend ya lo ha rotado pero la
    // cookie nueva no llega nunca y la sesión queda muerta. Pasa sobre todo
    // cuando un test falla a mitad de pantalla.
    await Promise.all(
      abiertas.map((p) => p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})),
    );
    await Promise.all(abiertas.map((p) => p.close()));
    // Tras cada test, la cookie ya rotada vuelve al fichero: si un fallo
    // hace que Playwright cambie de worker, el nuevo carga un refresh
    // vivo y no el de la primera sesión, ya en la lista negra.
    await guardarSesiones(contextos);
  },
});

export { expect } from "@playwright/test";
