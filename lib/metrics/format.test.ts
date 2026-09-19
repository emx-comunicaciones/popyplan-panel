import { afterEach, describe, expect, it } from "vitest";

import { formatCount, formatPct } from "./format";

const originalHtmlLang = document.documentElement.lang;
afterEach(() => {
  document.documentElement.lang = originalHtmlLang;
});

describe("formatCount", () => {
  it("separa los miles con punto (locale es-ES)", () => {
    expect(formatCount(1284)).toBe("1.284");
  });

  it("no separa un número pequeño", () => {
    expect(formatCount(4)).toBe("4");
  });

  it("value null + suppressed → '<5'", () => {
    expect(formatCount(null, true)).toBe("<5");
  });

  it("value null sin suppressed → '—' (sin dato, no suprimido)", () => {
    expect(formatCount(null)).toBe("—");
  });

  it("con value no nulo se pinta el valor real, aunque `suppressed` sea true (fix de carry-over W6: el `suppressed` es de toda la sección, no de esta celda — docs/PANEL.md §1.4/§1.5)", () => {
    expect(formatCount(8, true)).toBe("8");
  });

  it.each(["es", "eu", "ca"] as const)(
    "con <html lang>=%s el separador de miles no cambia (spec i18n: los tres locales lo comparten)",
    (lang) => {
      document.documentElement.lang = lang;
      expect(formatCount(1234)).toBe("1.234");
    },
  );
});

describe("formatPct", () => {
  it("formatea con coma decimal y símbolo de porcentaje", () => {
    expect(formatPct(0.75)).toBe("75,0 %");
  });

  it("redondea a un decimal", () => {
    expect(formatPct(0.7272727272727273)).toBe("72,7 %");
  });

  it("value null + suppressed → '<5'", () => {
    expect(formatPct(null, true)).toBe("<5");
  });

  it("value null sin suppressed → '—' (denominador 0, docs/PANEL.md §1.4)", () => {
    expect(formatPct(null)).toBe("—");
  });

  it("con value no nulo se pinta el valor real, aunque `suppressed` sea true", () => {
    expect(formatPct(0.75, true)).toBe("75,0 %");
  });

  it.each(["es", "eu", "ca"] as const)(
    "con <html lang>=%s el decimal sigue con coma (spec i18n: los tres locales lo comparten)",
    (lang) => {
      document.documentElement.lang = lang;
      expect(formatPct(0.75)).toBe("75,0 %");
    },
  );
});
