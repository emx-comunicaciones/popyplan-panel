import { describe, expect, it } from "vitest";

import {
  EVENT_CAPACITY_TOO_LOW_ERROR_KEY,
  EVENT_COMMUNITY_REQUIRED_ERROR_KEY,
  EVENT_ENDS_AT_BEFORE_STARTS_AT_ERROR_KEY,
  EVENT_STARTS_AT_PAST_ERROR_KEY,
  validateEventCapacity,
  validateEventCommunity,
  validateEventEndsAt,
  validateEventStartsAt,
} from "./validation";

describe("validateEventStartsAt", () => {
  it("vacío es válido (otra validación exige el campo)", () => {
    expect(validateEventStartsAt("")).toBeNull();
  });

  it("una fecha pasada es inválida al crear (sin original)", () => {
    expect(validateEventStartsAt("2020-01-01T00:00:00.000Z")).toBe(EVENT_STARTS_AT_PAST_ERROR_KEY);
  });

  it("una fecha futura es válida", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(validateEventStartsAt(future)).toBeNull();
  });

  it("al editar, si no cambió respecto al original, no se valida aunque sea pasada", () => {
    const past = "2020-01-01T00:00:00.000Z";
    expect(validateEventStartsAt(past, past)).toBeNull();
  });

  it("al editar, si cambió, sí se valida", () => {
    const past = "2020-01-01T00:00:00.000Z";
    const otherPast = "2019-01-01T00:00:00.000Z";
    expect(validateEventStartsAt(past, otherPast)).toBe(EVENT_STARTS_AT_PAST_ERROR_KEY);
  });
});

describe("validateEventEndsAt", () => {
  it("sin alguna de las dos fechas, válido", () => {
    expect(validateEventEndsAt("", "2026-01-01T10:00:00.000Z")).toBeNull();
    expect(validateEventEndsAt("2026-01-01T10:00:00.000Z", "")).toBeNull();
  });

  it("fin igual o anterior a inicio es inválido", () => {
    expect(
      validateEventEndsAt("2026-01-01T10:00:00.000Z", "2026-01-01T10:00:00.000Z"),
    ).toBe(EVENT_ENDS_AT_BEFORE_STARTS_AT_ERROR_KEY);
    expect(
      validateEventEndsAt("2026-01-01T10:00:00.000Z", "2026-01-01T09:00:00.000Z"),
    ).toBe(EVENT_ENDS_AT_BEFORE_STARTS_AT_ERROR_KEY);
  });

  it("fin posterior a inicio es válido", () => {
    expect(
      validateEventEndsAt("2026-01-01T10:00:00.000Z", "2026-01-01T11:00:00.000Z"),
    ).toBeNull();
  });

  it("una fecha ilegible no rompe (se trata como válida, otra validación se encarga)", () => {
    expect(validateEventEndsAt("no-es-fecha", "2026-01-01T11:00:00.000Z")).toBeNull();
  });
});

describe("validateEventCapacity", () => {
  it("vacío es válido (sin límite)", () => {
    expect(validateEventCapacity("")).toBeNull();
    expect(validateEventCapacity("   ")).toBeNull();
  });

  it("menor que 1 es inválido", () => {
    expect(validateEventCapacity("0")).toBe(EVENT_CAPACITY_TOO_LOW_ERROR_KEY);
    expect(validateEventCapacity("-3")).toBe(EVENT_CAPACITY_TOO_LOW_ERROR_KEY);
  });

  it("1 o más es válido", () => {
    expect(validateEventCapacity("1")).toBeNull();
    expect(validateEventCapacity("50")).toBeNull();
  });

  it("no numérico no rompe (se trata como válido)", () => {
    expect(validateEventCapacity("abc")).toBeNull();
  });
});

describe("validateEventCommunity", () => {
  it("audiencia community sin comunidad es inválida", () => {
    expect(validateEventCommunity("community", "")).toBe(EVENT_COMMUNITY_REQUIRED_ERROR_KEY);
  });

  it("audiencia community con comunidad es válida", () => {
    expect(validateEventCommunity("community", "abc-123")).toBeNull();
  });

  it("otras audiencias no exigen comunidad", () => {
    expect(validateEventCommunity("anyone", "")).toBeNull();
    expect(validateEventCommunity("organization", "")).toBeNull();
  });
});
