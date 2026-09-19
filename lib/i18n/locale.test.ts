import { afterEach, describe, expect, it, vi } from "vitest";

import { activeLanguage, localeFor } from "./locale";

describe("localeFor", () => {
  it("es → es-ES", () => {
    expect(localeFor("es")).toBe("es-ES");
  });

  it("eu → eu-ES", () => {
    expect(localeFor("eu")).toBe("eu-ES");
  });

  it("ca → ca-ES", () => {
    expect(localeFor("ca")).toBe("ca-ES");
  });
});

describe("activeLanguage", () => {
  const originalLang = document.documentElement.lang;

  afterEach(() => {
    document.documentElement.lang = originalLang;
  });

  it("lee document.documentElement.lang cuando es un idioma soportado", () => {
    document.documentElement.lang = "eu";
    expect(activeLanguage()).toBe("eu");
  });

  it("con ca en <html lang> devuelve ca", () => {
    document.documentElement.lang = "ca";
    expect(activeLanguage()).toBe("ca");
  });

  it("con un valor no soportado en <html lang> cae a es", () => {
    document.documentElement.lang = "en";
    expect(activeLanguage()).toBe("es");
  });

  it("con <html lang> vacío cae a es", () => {
    document.documentElement.lang = "";
    expect(activeLanguage()).toBe("es");
  });

  it("sin document (render de servidor, sin hidratar) cae a es", () => {
    vi.stubGlobal("document", undefined);
    try {
      expect(activeLanguage()).toBe("es");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
