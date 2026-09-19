import { afterEach, describe, expect, it } from "vitest";

import { eurosToCents, formatEuros } from "./money";

const originalHtmlLang = document.documentElement.lang;
afterEach(() => {
  document.documentElement.lang = originalHtmlLang;
});

// `Intl.NumberFormat` de moneda separa el importe del símbolo con un
// espacio irrompible (` `), no un espacio normal.
const NBSP = " ";

describe("formatEuros", () => {
  it("formatea céntimos como euros en es-ES", () => {
    expect(formatEuros(123456)).toBe(`1.234,56${NBSP}€`);
  });

  it.each(["es", "eu", "ca"] as const)(
    "con <html lang>=%s el formato no cambia (spec i18n: los tres locales lo comparten)",
    (lang) => {
      document.documentElement.lang = lang;
      expect(formatEuros(123456)).toBe(`1.234,56${NBSP}€`);
    },
  );

  it("cero se pinta como 0,00 €", () => {
    expect(formatEuros(0)).toBe(`0,00${NBSP}€`);
  });
});

describe("eurosToCents", () => {
  it("convierte una cadena con punto decimal", () => {
    expect(eurosToCents("19.99")).toBe(1999);
  });

  it("convierte una cadena con coma decimal", () => {
    expect(eurosToCents("19,99")).toBe(1999);
  });

  it("no arrastra el error de coma flotante de multiplicar por 100", () => {
    expect(eurosToCents("19.99")).toBe(1999);
    expect(eurosToCents("0.1")).toBe(10);
  });

  it("un entero sin decimales", () => {
    expect(eurosToCents("1200")).toBe(120000);
  });

  it("cadena vacía da NaN", () => {
    expect(Number.isNaN(eurosToCents(""))).toBe(true);
  });

  it("cadena no numérica da NaN", () => {
    expect(Number.isNaN(eurosToCents("abc"))).toBe(true);
  });

  it("acepta un importe pegado con separador de millares es-ES", () => {
    expect(eurosToCents("1.234,56")).toBe(123456);
    expect(eurosToCents("1.234.567,89")).toBe(123456789);
  });

  it("acepta espacios dentro del importe (incluido el irrompible)", () => {
    expect(eurosToCents("1 234,56")).toBe(123456);
    expect(eurosToCents("1 234,56")).toBe(123456);
  });

  it("sin coma decimal, el punto se sigue leyendo como decimal", () => {
    // `<input type="number">` siempre manda punto decimal: «1.234» son
    // 1,234 €, no 1.234 €.
    expect(eurosToCents("1.234")).toBe(123);
  });

  it("un importe negativo da NaN (un presupuesto no puede serlo)", () => {
    expect(Number.isNaN(eurosToCents("-1"))).toBe(true);
    expect(Number.isNaN(eurosToCents("-19,99"))).toBe(true);
  });

  it("dos comas decimales dan NaN", () => {
    expect(Number.isNaN(eurosToCents("1,2,3"))).toBe(true);
  });
});
