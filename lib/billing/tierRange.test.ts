import { describe, expect, it } from "vitest";

import {
  TIER_MAX_BELOW_MIN_ERROR_KEY,
  TIER_MAX_INVALID_ERROR_KEY,
  TIER_MIN_NEGATIVE_ERROR_KEY,
  tierRangeFromFields,
  validateTierRange,
} from "./tierRange";

describe("tierRangeFromFields", () => {
  it("campo vacío: mínimo 0, máximo sin tope", () => {
    expect(tierRangeFromFields("", "")).toEqual({ min: 0, max: null });
  });

  it("lee los dos números", () => {
    expect(tierRangeFromFields("5000", "20000")).toEqual({ min: 5000, max: 20000 });
  });

  it("un campo que no es un número llega como NaN, no como 0", () => {
    const range = tierRangeFromFields("0", "12e");
    expect(Number.isNaN(range.max)).toBe(true);
  });
});

describe("validateTierRange", () => {
  it("rango válido, con y sin tope", () => {
    expect(validateTierRange({ min: 0, max: 5000 })).toBeNull();
    expect(validateTierRange({ min: 20000, max: null })).toBeNull();
    expect(validateTierRange({ min: 5000, max: 5000 })).toBeNull();
  });

  it("mínimo negativo o no numérico", () => {
    expect(validateTierRange({ min: -1, max: null })).toBe(TIER_MIN_NEGATIVE_ERROR_KEY);
    expect(validateTierRange({ min: Number.NaN, max: null })).toBe(TIER_MIN_NEGATIVE_ERROR_KEY);
  });

  it("máximo no numérico (defensa: el navegador ya lo filtra)", () => {
    expect(validateTierRange({ min: 0, max: Number.NaN })).toBe(TIER_MAX_INVALID_ERROR_KEY);
    expect(validateTierRange({ min: 0, max: Number.POSITIVE_INFINITY })).toBe(TIER_MAX_INVALID_ERROR_KEY);
  });

  it("máximo por debajo del mínimo", () => {
    expect(validateTierRange({ min: 20000, max: 5000 })).toBe(TIER_MAX_BELOW_MIN_ERROR_KEY);
  });
});
