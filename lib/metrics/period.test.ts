import { describe, expect, it } from "vitest";

import { customPeriod, presetPeriod, validatePeriod } from "./period";

const TODAY = new Date("2026-03-15T12:00:00Z");

describe("presetPeriod", () => {
  it("mes: desde el día 1 del mes en curso hasta hoy", () => {
    expect(presetPeriod("mes", TODAY)).toEqual({ since: "2026-03-01", until: "2026-03-15" });
  });

  it("trimestre: últimos 3 meses hasta hoy", () => {
    expect(presetPeriod("trimestre", TODAY)).toEqual({ since: "2025-12-15", until: "2026-03-15" });
  });

  it("año: últimos 12 meses hasta hoy", () => {
    expect(presetPeriod("anio", TODAY)).toEqual({ since: "2025-03-15", until: "2026-03-15" });
  });

  it("cualquier preset produce un periodo de ≤ 366 días (nunca dispara la validación de longitud)", () => {
    for (const preset of ["mes", "trimestre", "anio"] as const) {
      const period = presetPeriod(preset, TODAY);
      expect(validatePeriod(period.since, period.until)).toBeNull();
    }
  });
});

describe("validatePeriod", () => {
  it("acepta un rango válido", () => {
    expect(validatePeriod("2026-01-01", "2026-01-31")).toBeNull();
  });

  it("rechaza since > until", () => {
    expect(validatePeriod("2026-02-01", "2026-01-01")).toBe("rango_invertido");
  });

  it("rechaza un periodo de más de 366 días", () => {
    expect(validatePeriod("2025-01-01", "2026-01-02")).toBe("periodo_demasiado_largo");
  });

  it("acepta un periodo de exactamente 366 días", () => {
    expect(validatePeriod("2025-01-01", "2026-01-01")).toBeNull();
  });

  it("rechaza una fecha no parseable", () => {
    expect(validatePeriod("no-es-fecha", "2026-01-01")).toBe("fecha_invalida");
    expect(validatePeriod("2026-01-01", "31/01/2026")).toBe("fecha_invalida");
  });
});

describe("customPeriod", () => {
  it("con fechas válidas devuelve el periodo y ningún error", () => {
    expect(customPeriod("2026-01-01", "2026-01-31")).toEqual({
      period: { since: "2026-01-01", until: "2026-01-31" },
      error: null,
    });
  });

  it("con fechas inválidas devuelve el error y ningún periodo", () => {
    expect(customPeriod("2026-02-01", "2026-01-01")).toEqual({
      period: null,
      error: "rango_invertido",
    });
  });
});
