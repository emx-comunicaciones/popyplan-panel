import { describe, expect, it } from "vitest";

import { plataformaMenuFor } from "./plataformaMenu";

describe("plataformaMenuFor", () => {
  it("superadmin ve todo", () => {
    expect(plataformaMenuFor("superadmin")).toEqual([
      "inicio",
      "entidades",
      "reportes",
      "ayuda",
      "verificaciones",
      "roles",
      "auditoria",
      "metricas",
    ]);
  });

  it("verifier ve inicio, entidades y verificaciones", () => {
    expect(plataformaMenuFor("verifier")).toEqual(["inicio", "entidades", "verificaciones"]);
  });

  it("moderator ve inicio, reportes, ayuda y métricas", () => {
    expect(plataformaMenuFor("moderator")).toEqual(["inicio", "reportes", "ayuda", "metricas"]);
  });

  it("support ve lo mismo que moderator (solo lectura en las páginas)", () => {
    expect(plataformaMenuFor("support")).toEqual(["inicio", "reportes", "ayuda", "metricas"]);
  });

  it("sin rol, sin menú", () => {
    expect(plataformaMenuFor(null)).toEqual([]);
    expect(plataformaMenuFor(undefined)).toEqual([]);
    expect(plataformaMenuFor("otro")).toEqual([]);
  });
});
