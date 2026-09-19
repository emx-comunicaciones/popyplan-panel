import { describe, expect, it } from "vitest";

import { ENTIDAD_MENU_ITEMS, entidadMenuFor } from "./entidadMenu";

describe("entidadMenuFor", () => {
  it("titular ve las 14 secciones", () => {
    expect(entidadMenuFor("titular")).toEqual([...ENTIDAD_MENU_ITEMS]);
  });

  it("moderador ve las 14 secciones", () => {
    expect(entidadMenuFor("moderador")).toEqual([...ENTIDAD_MENU_ITEMS]);
  });

  it("dinamizador no ve Configuración, Reportes ni Comunicaciones (sin permiso)", () => {
    const menu = entidadMenuFor("dinamizador");

    expect(menu).not.toContain("configuracion");
    expect(menu).not.toContain("reportes");
    expect(menu).not.toContain("comunicaciones");
    expect(menu).not.toContain("informes");
    expect(menu).toContain("inicio");
    expect(menu).toContain("actividades");
    expect(menu).toContain("comunidades");
    expect(menu).toContain("guardia");
  });

  it("dinamizador recupera Encuestas y Recursos en W4b (ya tienen página real)", () => {
    const menu = entidadMenuFor("dinamizador");

    expect(menu).toContain("encuestas");
    expect(menu).toContain("biblioteca");
  });

  it("dinamizador ve Familias, ya con página real (ronda final de Fase 5)", () => {
    expect(entidadMenuFor("dinamizador")).toContain("familias");
  });

  it("dinamizador ve Programas (tarea W3, Fase 6)", () => {
    expect(entidadMenuFor("dinamizador")).toContain("programas");
  });

  it("analista no ve Personas ni Configuración: solo Inicio, Programas e Informes", () => {
    expect(entidadMenuFor("analista")).toEqual(["inicio", "programas", "informes"]);
  });

  it("referente ve Inicio, Personas, Actividades y Programas", () => {
    expect(entidadMenuFor("referente")).toEqual([
      "inicio",
      "personas",
      "actividades",
      "programas",
    ]);
  });

  it("un rol desconocido no ve ninguna sección", () => {
    expect(entidadMenuFor("voluntario")).toEqual([]);
  });
});
