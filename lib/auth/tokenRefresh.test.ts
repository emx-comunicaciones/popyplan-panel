import { describe, expect, it } from "vitest";

import { parseRefreshedTokens } from "./tokenRefresh";

describe("parseRefreshedTokens", () => {
  it("acepta la respuesta del contrato", () => {
    expect(parseRefreshedTokens({ access: "a", refresh: "r" })).toEqual({
      access: "a",
      refresh: "r",
    });
  });

  it("ignora campos de más", () => {
    expect(parseRefreshedTokens({ access: "a", refresh: "r", extra: 1 })).toEqual({
      access: "a",
      refresh: "r",
    });
  });

  it("rechaza un cuerpo sin los dos tokens", () => {
    expect(parseRefreshedTokens({})).toBeNull();
    expect(parseRefreshedTokens({ access: "a" })).toBeNull();
    expect(parseRefreshedTokens({ refresh: "r" })).toBeNull();
  });

  it("rechaza tokens que no son cadena", () => {
    expect(parseRefreshedTokens({ access: 1, refresh: "r" })).toBeNull();
    expect(parseRefreshedTokens({ access: "a", refresh: null })).toBeNull();
  });

  it("rechaza lo que no es un objeto", () => {
    expect(parseRefreshedTokens(null)).toBeNull();
    expect(parseRefreshedTokens(undefined)).toBeNull();
    expect(parseRefreshedTokens("no es JSON")).toBeNull();
  });
});
