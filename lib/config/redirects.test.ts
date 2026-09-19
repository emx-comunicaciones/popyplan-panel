import { describe, expect, it } from "vitest";

import { permanentRedirects } from "./redirects";

describe("permanentRedirects", () => {
  it("redirige la ruta vieja de Recursos a Biblioteca conservando el slug", () => {
    expect(permanentRedirects()).toContainEqual({
      source: "/entidad/:slug/recursos",
      destination: "/entidad/:slug/biblioteca",
      permanent: true,
    });
  });

  it("redirige la ruta vieja de Contratos a Suscripciones", () => {
    expect(permanentRedirects()).toContainEqual({
      source: "/plataforma/contratos",
      destination: "/plataforma/suscripciones",
      permanent: true,
    });
  });

  it("todas las redirecciones son permanentes (308)", () => {
    expect(permanentRedirects().every((rule) => rule.permanent)).toBe(true);
  });
});
