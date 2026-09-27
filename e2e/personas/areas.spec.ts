import { expect, test } from "./fixtures";
import { mundo } from "./personas";

/**
 * Cada personaje, con su sesión de verdad, aterriza en su área
 * (`lib/auth/area.ts::resolveArea`), y la cuenta de la app no entra en
 * ninguna.
 */
test("la titular y la moderadora de la asociación entran en su entidad", async ({ como }) => {
  const slug = mundo().entidades.asociacion.slug;
  for (const clave of ["asociacion", "moderadora"]) {
    const pagina = await como(clave);
    await pagina.goto("/");
    await expect(pagina).toHaveURL(new RegExp(`/entidad/${slug}`));
    await expect(pagina.getByRole("heading", { name: "Inicio", level: 1 })).toBeVisible();
  }
});

test("el ayuntamiento entra en su área de administración", async ({ como }) => {
  const pagina = await como("ayuntamiento");
  await pagina.goto("/");
  await expect(pagina).toHaveURL(new RegExp(`/paraguas/${mundo().entidades.ayuntamiento.slug}`));
});

test("la superadmin entra en plataforma", async ({ como }) => {
  const pagina = await como("plataforma");
  await pagina.goto("/");
  await expect(pagina).toHaveURL(/\/plataforma/);
});

test("la usuaria de la app no tiene panel", async ({ como }) => {
  const pagina = await como("usuaria");
  await pagina.goto("/");
  await expect(pagina.getByRole("heading", { name: "Tu cuenta es de la app Popyplan" }))
    .toBeVisible();
});
