import { describe, expect, it } from "vitest";

import { safeReturnTo } from "./returnTo";

describe("safeReturnTo", () => {
  it("acepta una ruta interna de un área del panel", () => {
    expect(safeReturnTo("/entidad/alfaville/personas")).toBe("/entidad/alfaville/personas");
    expect(safeReturnTo("/paraguas/diputacion-demo")).toBe("/paraguas/diputacion-demo");
    expect(safeReturnTo("/plataforma/entidades")).toBe("/plataforma/entidades");
    expect(safeReturnTo("/elegir-entidad")).toBe("/elegir-entidad");
  });

  it("conserva la cadena de consulta", () => {
    expect(safeReturnTo("/entidad/alfaville/personas?page=3")).toBe(
      "/entidad/alfaville/personas?page=3",
    );
  });

  it("rechaza una URL absoluta a otro sitio", () => {
    expect(safeReturnTo("https://evil.example/entidad/x")).toBeNull();
    expect(safeReturnTo("http://evil.example")).toBeNull();
  });

  it("rechaza las rutas protocol-relative (//evil.com)", () => {
    expect(safeReturnTo("//evil.example/entidad/x")).toBeNull();
  });

  it("rechaza barras invertidas (algunos navegadores las normalizan a /)", () => {
    expect(safeReturnTo("/\\evil.example")).toBeNull();
    expect(safeReturnTo("/entidad/\\evil.example")).toBeNull();
  });

  it("rechaza rutas de fuera del panel, incluido el propio login", () => {
    expect(safeReturnTo("/login")).toBeNull();
    expect(safeReturnTo("/")).toBeNull();
    expect(safeReturnTo("/accesibilidad")).toBeNull();
    expect(safeReturnTo("/entidadfalsa")).toBeNull();
  });

  it("rechaza caracteres de control y valores que no son cadena", () => {
    expect(safeReturnTo("/entidad/x\nalgo")).toBeNull();
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo("")).toBeNull();
  });
});
