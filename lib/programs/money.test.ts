import { describe, expect, it } from "vitest";

import { eurosToCents, formatEuros } from "./money";

// `Intl.NumberFormat` de moneda separa el importe del símbolo con un
// espacio irrompible (` `), no un espacio normal.
const NBSP = " ";

describe("formatEuros", () => {
  it("formatea céntimos como euros en es-ES", () => {
    expect(formatEuros(123456)).toBe(`1.234,56${NBSP}€`);
  });

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
});
