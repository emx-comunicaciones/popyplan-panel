import { describe, expect, it } from "vitest";

import { DEFAULT_LANGUAGE, isSupportedLanguage, SUPPORTED_LANGUAGES } from "./languages";

describe("SUPPORTED_LANGUAGES", () => {
  it("es, eu y ca, en ese orden (decisión 1 del diseño: es por defecto)", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["es", "eu", "ca"]);
  });

  it("el idioma por defecto es es", () => {
    expect(DEFAULT_LANGUAGE).toBe("es");
  });
});

describe("isSupportedLanguage", () => {
  it.each(["es", "eu", "ca"] as const)("%s es un idioma soportado", (lang) => {
    expect(isSupportedLanguage(lang)).toBe(true);
  });

  it("un idioma no soportado (inglés, no se ofrece a las personas) es false", () => {
    expect(isSupportedLanguage("en")).toBe(false);
  });

  it("una cadena arbitraria es false", () => {
    expect(isSupportedLanguage("de")).toBe(false);
  });

  it("undefined y null son false", () => {
    expect(isSupportedLanguage(undefined)).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
  });

  it("cadena vacía es false", () => {
    expect(isSupportedLanguage("")).toBe(false);
  });
});
