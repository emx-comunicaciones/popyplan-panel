import { expect, test as setup } from "@playwright/test";

import { PERSONAJES_CON_SESION, persona, rutaSesion } from "./personas";

/**
 * Un `storageState` por personaje, con el login de verdad por la pantalla
 * (no por API): el formulario, `POST /api/session` y la cookie httpOnly
 * `pp_session` con el refresh, igual que una persona.
 *
 * Ojo con la rotación: el refresh **rota y va a la lista negra en cada
 * uso** (`docs/historial/sesion-y-seguridad.md`). Por eso los specs no
 * crean un contexto nuevo desde este fichero en cada test (el segundo
 * llegaría con un refresh ya usado): lo cargan **una vez por worker** y
 * reutilizan ese contexto vivo (`fixtures.ts`).
 */
for (const clave of PERSONAJES_CON_SESION) {
  setup(`inicia sesión como ${clave}`, async ({ page }) => {
    const p = persona(clave);
    await page.goto("/login");
    await page.getByLabel("Usuario o email").fill(p.email);
    await page.getByLabel("Contraseña").fill(p.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    // Tras el login el panel encadena navegaciones (`/` → su área) y cada
    // una rota el refresh en el middleware: se guarda cuando ya ha llegado
    // y no queda nada en vuelo, o se guardaría un refresh ya gastado.
    const destino = { entidad: /\/entidad\//, paraguas: /\/paraguas\//, plataforma: /\/plataforma/ };
    await expect(page).toHaveURL(p.area_panel ? destino[p.area_panel] : /\/$/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await page.context().storageState({ path: rutaSesion(clave) });
  });
}
