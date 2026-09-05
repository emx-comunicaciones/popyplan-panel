import { describe, expect, it } from "vitest";

import { ENTIDAD_MENU_ITEMS, entidadMenuFor } from "./entidadMenu";

describe("entidadMenuFor", () => {
  it("titular ve las 13 secciones", () => {
    expect(entidadMenuFor("titular")).toEqual([...ENTIDAD_MENU_ITEMS]);
  });

  it("moderador ve las 13 secciones", () => {
    expect(entidadMenuFor("moderador")).toEqual([...ENTIDAD_MENU_ITEMS]);
  });

  it("dinamizador no ve Configuración, Reportes ni las secciones aún sin página (W4b)", () => {
    const menu = entidadMenuFor("dinamizador");

    expect(menu).not.toContain("configuracion");
    expect(menu).not.toContain("reportes");
    expect(menu).not.toContain("comunicaciones");
    expect(menu).not.toContain("encuestas");
    expect(menu).not.toContain("recursos");
    expect(menu).not.toContain("familias");
    expect(menu).toContain("inicio");
    expect(menu).toContain("actividades");
    expect(menu).toContain("comunidades");
    expect(menu).toContain("guardia");
  });

  it("analista no ve Personas ni Configuración: solo Inicio e Informes", () => {
    expect(entidadMenuFor("analista")).toEqual(["inicio", "informes"]);
  });

  it("referente ve Inicio, Personas y Actividades", () => {
    expect(entidadMenuFor("referente")).toEqual(["inicio", "personas", "actividades"]);
  });

  it("un rol desconocido no ve ninguna sección", () => {
    expect(entidadMenuFor("voluntario")).toEqual([]);
  });
});
