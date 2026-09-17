import { describe, expect, it } from "vitest";

import { PLATFORM_ROLES, isPlatformRole, plataformaMenuFor } from "./plataformaMenu";

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
      "contratos",
    ]);
  });

  it("verifier ve inicio, entidades y verificaciones", () => {
    expect(plataformaMenuFor("verifier")).toEqual(["inicio", "entidades", "verificaciones"]);
  });

  it("moderator ve inicio, reportes, ayuda y métricas", () => {
    expect(plataformaMenuFor("moderator")).toEqual(["inicio", "reportes", "ayuda", "metricas"]);
  });

  it("support ve lo mismo que moderator más Contratos (lectura de facturación, W4)", () => {
    expect(plataformaMenuFor("support")).toEqual(["inicio", "reportes", "ayuda", "metricas", "contratos"]);
  });

  it("sin rol, sin menú", () => {
    expect(plataformaMenuFor(null)).toEqual([]);
    expect(plataformaMenuFor(undefined)).toEqual([]);
    expect(plataformaMenuFor("otro")).toEqual([]);
  });

  it("PLATFORM_ROLES lista los cuatro roles conocidos y isPlatformRole los reconoce", () => {
    expect([...PLATFORM_ROLES]).toEqual(["superadmin", "verifier", "moderator", "support"]);
    for (const role of PLATFORM_ROLES) {
      expect(isPlatformRole(role)).toBe(true);
    }
    expect(isPlatformRole("rol-que-el-backend-inventa")).toBe(false);
    expect(isPlatformRole(null)).toBe(false);
  });
});
