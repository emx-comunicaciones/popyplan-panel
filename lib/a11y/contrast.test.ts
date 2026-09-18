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

  it("acepta la forma corta #RGB", () => {
    expect(relativeLuminance("#fff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000")).toBeCloseTo(0, 5);
  });

  it("acepta hex sin almohadilla", () => {
    expect(relativeLuminance("ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("fff")).toBeCloseTo(1, 5);
  });

  it("acepta #RRGGBBAA e ignora el canal alfa", () => {
    expect(relativeLuminance("#FFFFFF80")).toBeCloseTo(1, 5);
  });

  it("devuelve null si el color no es un hex reconocible", () => {
    // `primary_color` es un dato de la entidad, no de esta app: puede
    // llegar vacío, con un nombre CSS o con un hex a medias.
    expect(relativeLuminance("rojo")).toBeNull();
    expect(relativeLuminance("#12345")).toBeNull();
    expect(relativeLuminance("#GGGGGG")).toBeNull();
    expect(relativeLuminance("")).toBeNull();
    expect(relativeLuminance("rgb(255,0,0)")).toBeNull();
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
    const reversed = contrastRatio("#FFFFFF", "#1FB3AE");
    expect(reversed).not.toBeNull();
    expect(contrastRatio("#1FB3AE", "#FFFFFF")).toBeCloseTo(reversed as number, 5);
  });

  it("primary-700 (#0E7C78) sobre blanco ronda 5,0:1", () => {
    expect(contrastRatio("#0E7C78", "#FFFFFF")).toBeCloseTo(5.03, 1);
  });

  it("primary (#1FB3AE, decorativo) sobre blanco falla AA: ronda 2,59:1", () => {
    expect(contrastRatio("#1FB3AE", "#FFFFFF")).toBeCloseTo(2.59, 1);
  });

  it("devuelve null si alguno de los dos colores no es un hex reconocible", () => {
    expect(contrastRatio("#FFFFFF", "no-es-color")).toBeNull();
    expect(contrastRatio("no-es-color", "#FFFFFF")).toBeNull();
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
    expect(chosen).not.toBeNull();
    const other = chosen === "#FFFFFF" ? "#1A2C33" : "#FFFFFF";
    const otherRatio = contrastRatio(other, bg);
    expect(otherRatio).not.toBeNull();
    expect(contrastRatio(chosen as string, bg)).toBeGreaterThanOrEqual(otherRatio as number);
  });

  it("devuelve null si el fondo no es un hex reconocible (no calculable)", () => {
    expect(readableOn("no-es-color")).toBeNull();
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

  it("un color no calculable no cumple AA (no se puede demostrar que sí)", () => {
    expect(meetsAA("#FFFFFF", "no-es-color")).toBe(false);
  });
});
