import { afterEach, describe, expect, it, vi } from "vitest";

import { LANG_COOKIE_NAME, langCookieOptions, resolveLanguage } from "./cookie";

describe("LANG_COOKIE_NAME", () => {
  it("es pp_lang", () => {
    expect(LANG_COOKIE_NAME).toBe("pp_lang");
  });
});

describe("langCookieOptions", () => {
  it("no es httpOnly (el cliente la lee para pintar el selector activo)", () => {
    expect(langCookieOptions().httpOnly).toBe(false);
  });

  it("SameSite=Lax, path raíz y un año de vida", () => {
    const options = langCookieOptions();
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(60 * 60 * 24 * 365);
  });

  /**
   * M1 de la revisión final de la rama: `lib/auth/cookie.ts::sessionCookieOptions`
   * ya fija `secure` según `NODE_ENV` y el docstring de este módulo decía
   * seguir «igual criterio salvo `httpOnly`» — pero no lo hacía. La
   * cookie no es sensible, pero la divergencia con su módulo hermano no
   * estaba justificada.
   */
  describe("secure", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      vi.stubEnv("NODE_ENV", originalEnv ?? "test");
    });

    it("es true en producción", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(langCookieOptions().secure).toBe(true);
    });

    it("es false fuera de producción", () => {
      vi.stubEnv("NODE_ENV", "test");
      expect(langCookieOptions().secure).toBe(false);
    });
  });
});

describe("resolveLanguage", () => {
  it("la cookie manda cuando es un idioma soportado", () => {
    expect(resolveLanguage({ cookie: "eu", acceptLanguage: "ca" })).toBe("eu");
  });

  it("una cookie con un valor no soportado se ignora y se sigue mirando Accept-Language", () => {
    expect(resolveLanguage({ cookie: "de", acceptLanguage: "ca" })).toBe("ca");
  });

  it("sin cookie, toma el primer idioma soportado de Accept-Language", () => {
    expect(resolveLanguage({ acceptLanguage: "eu-ES,eu;q=0.9,es;q=0.8" })).toBe("eu");
  });

  it("Accept-Language con un idioma no soportado (de) cae a es", () => {
    expect(resolveLanguage({ acceptLanguage: "de" })).toBe("es");
  });

  it("Accept-Language con un idioma no soportado seguido de uno soportado toma el soportado", () => {
    expect(resolveLanguage({ acceptLanguage: "de-DE,de;q=0.9,ca;q=0.8" })).toBe("ca");
  });

  it("sin cookie ni Accept-Language, cae a es", () => {
    expect(resolveLanguage({})).toBe("es");
  });

  it("cookie y Accept-Language ausentes o null se tratan igual que ausentes", () => {
    expect(resolveLanguage({ cookie: null, acceptLanguage: null })).toBe("es");
  });

  it("Accept-Language solo con región (es-ES) reconoce el idioma base", () => {
    expect(resolveLanguage({ acceptLanguage: "ca-ES" })).toBe("ca");
  });

  /**
   * M2 de la revisión final de la rama: la función tomaba el primer
   * idioma soportado **en orden de aparición**, sin mirar `;q=`. Los
   * navegadores ordenan de calidad descendente por convención, así que
   * en la práctica no pasaba, pero un cliente que no ordene (o un proxy
   * que reescriba la cabecera) obtenía el idioma equivocado.
   */
  it("respeta ;q= aunque los idiomas no vengan en orden de calidad descendente", () => {
    expect(resolveLanguage({ acceptLanguage: "de,ca;q=0.2,es;q=0.9" })).toBe("es");
  });

  it("con la misma calidad implícita (1), gana el primero en aparecer", () => {
    expect(resolveLanguage({ acceptLanguage: "eu,ca" })).toBe("eu");
  });
});
