import { describe, expect, it } from "vitest";

import {
  EVENT_CAPACITY_TOO_LOW_ERROR_KEY,
  EVENT_COMMUNITY_REQUIRED_ERROR_KEY,
  EVENT_ENDS_AT_BEFORE_STARTS_AT_ERROR_KEY,
  EVENT_STARTS_AT_PAST_ERROR_KEY,
  sameMinute,
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

describe("validateEventStartsAt — editar una actividad que ya pasó", () => {
  /**
   * Bug encontrado pulsando «Editar» en el panel (auditoría 2026-09-24):
   * no se podía guardar **ninguna** actividad pasada. El valor guardado
   * lleva segundos (`21:16:12.933473Z`) y un `<input type="datetime-local">`
   * solo rehidrata hasta el minuto, así que el ISO reconstruido nunca era
   * igual al original: el formulario creía que la fecha había cambiado,
   * exigía que fuera futura y dejaba «Guardar» muerto con «La actividad
   * tiene que empezar en el futuro» aunque solo quisieras corregir una
   * errata del título.
   */
  const originalConSegundos = "2026-09-10T21:16:12.933473Z";
  const reconstruidoDelInput = "2026-09-10T21:16:00.000Z";

  it("no se queja si solo se perdieron los segundos al rehidratar", () => {
    expect(validateEventStartsAt(reconstruidoDelInput, originalConSegundos)).toBeNull();
  });

  it("sigue quejándose si de verdad se mueve la fecha al pasado", () => {
    expect(validateEventStartsAt("2026-09-09T21:16:00.000Z", originalConSegundos)).not.toBeNull();
  });

  it("deja mover una actividad pasada a una fecha futura", () => {
    const futuro = new Date(Date.now() + 86400000).toISOString();
    expect(validateEventStartsAt(futuro, originalConSegundos)).toBeNull();
  });
});

describe("sameMinute", () => {
  it("ignora segundos y milisegundos", () => {
    expect(sameMinute("2026-09-10T21:16:12.933Z", "2026-09-10T21:16:00.000Z")).toBe(true);
  });

  it("distingue minutos distintos", () => {
    expect(sameMinute("2026-09-10T21:16:59Z", "2026-09-10T21:17:00Z")).toBe(false);
  });

  it("compara instantes, no cadenas: la misma hora en otra zona es la misma", () => {
    expect(sameMinute("2026-09-10T23:16:12+02:00", "2026-09-10T21:16:00Z")).toBe(true);
  });

  it("con algo ilegible o vacío dice que no son iguales", () => {
    expect(sameMinute("", "2026-09-10T21:16:00Z")).toBe(false);
    expect(sameMinute("aqui", "2026-09-10T21:16:00Z")).toBe(false);
  });
});
