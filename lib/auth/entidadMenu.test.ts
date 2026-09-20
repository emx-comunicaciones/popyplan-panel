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
  });

  it("dinamizador NO ve Personas: la lista y la ficha son 403 para su rol (A-I3)", () => {
    // `panel/viewsets.py::ROLES_LISTA_PERSONAS` = titular/moderador/
    // referente, y `'ver_ficha'` de `entities/permissions.py` son esos
    // mismos tres. El menú ofrecía una sección que respondía 403 entera.
    expect(entidadMenuFor("dinamizador")).not.toContain("personas");
  });

  it("dinamizador NO ve Guardia salvo que sea la persona de guardia (D-I8)", () => {
    // `HelpRequestViewSet.pending` acepta `es_guardia or moderar`, y
    // `'moderar'` es {titular, moderador}.
    expect(entidadMenuFor("dinamizador")).not.toContain("guardia");
    expect(entidadMenuFor("dinamizador", { isOnCall: true })).toContain("guardia");
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

  it("la persona de guardia ve Guardia sea cual sea su rol, y en su sitio del menú", () => {
    // `Organization.on_call_user` admite cualquier `OrgMembership`
    // (`entities/serializers.py::validate_on_call_user`), así que una
    // analista o una referente nombrada guardia recibe los avisos por API
    // y necesita la pantalla.
    expect(entidadMenuFor("analista", { isOnCall: true })).toEqual([
      "inicio",
      "programas",
      "guardia",
      "informes",
    ]);
    expect(entidadMenuFor("referente", { isOnCall: true })).toEqual([
      "inicio",
      "personas",
      "actividades",
      "programas",
      "guardia",
    ]);
  });

  it("titular y moderador no cambian por ser la guardia (ya la veían)", () => {
    expect(entidadMenuFor("titular", { isOnCall: true })).toEqual([...ENTIDAD_MENU_ITEMS]);
    expect(entidadMenuFor("moderador", { isOnCall: true })).toEqual([...ENTIDAD_MENU_ITEMS]);
  });

  it("un rol desconocido no ve ninguna sección, ni siendo la guardia", () => {
    expect(entidadMenuFor("voluntario")).toEqual([]);
    expect(entidadMenuFor("voluntario", { isOnCall: true })).toEqual([]);
  });
});
