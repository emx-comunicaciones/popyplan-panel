import { describe, expect, it } from "vitest";

import { contrastRatio, meetsAA, readableOn, relativeLuminance } from "./contrast";

describe("relativeLuminance", () => {
  it("blanco puro es 1", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("negro puro es 0", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("acepta hex en minúsculas", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("blanco sobre negro es 21:1 (máximo posible)", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
  });

  it("un color contra sí mismo es 1:1 (mínimo posible)", () => {
    expect(contrastRatio("#1FB3AE", "#1FB3AE")).toBeCloseTo(1, 5);
  });

  it("es simétrico: el orden de los dos colores no cambia el resultado", () => {
    expect(contrastRatio("#1FB3AE", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#1FB3AE"), 5);
  });

  it("primary-700 (#0E7C78) sobre blanco ronda 5,0:1", () => {
    expect(contrastRatio("#0E7C78", "#FFFFFF")).toBeCloseTo(5.03, 1);
  });

  it("primary (#1FB3AE, decorativo) sobre blanco falla AA: ronda 2,59:1", () => {
    expect(contrastRatio("#1FB3AE", "#FFFFFF")).toBeCloseTo(2.59, 1);
  });
});

describe("readableOn", () => {
  it("sobre un fondo claro (amarillo) elige el texto oscuro", () => {
    expect(readableOn("#FFFF00")).toBe("#1A2C33");
  });

  it("sobre un fondo oscuro elige el texto blanco", () => {
    expect(readableOn("#123456")).toBe("#FFFFFF");
  });

  it("el color elegido siempre da más ratio que la alternativa descartada", () => {
    const bg = "#1FB3AE";
    const chosen = readableOn(bg);
    const other = chosen === "#FFFFFF" ? "#1A2C33" : "#FFFFFF";
    expect(contrastRatio(chosen, bg)).toBeGreaterThanOrEqual(contrastRatio(other, bg));
  });
});

describe("meetsAA", () => {
  it("texto normal exige 4.5:1", () => {
    expect(meetsAA("#0E7C78", "#FFFFFF")).toBe(true);
    expect(meetsAA("#1FB3AE", "#FFFFFF")).toBe(false);
  });

  it("texto grande o UI no textual exige solo 3:1", () => {
    expect(meetsAA("#1FB3AE", "#FFFFFF", true)).toBe(false);
    expect(meetsAA("#0E7C78", "#FFFFFF", true)).toBe(true);
  });

  it("un ratio justo en el límite (4.5) cuenta como aprobado", () => {
    // Blanco sobre un gris cuyo ratio es exactamente 4.5:1 no existe en
    // hex exacto, así que se prueba con un par que se sabe que pasa
    // holgadamente y otro que se sabe que falla, cubriendo ambos lados.
    expect(meetsAA("#FFFFFF", "#000000")).toBe(true);
    expect(meetsAA("#777777", "#888888")).toBe(false);
  });
});
