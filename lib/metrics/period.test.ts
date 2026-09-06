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

  it("cualquier preset produce un periodo que sigue validando (nunca dispara la validación de longitud)", () => {
    for (const preset of ["mes", "trimestre", "anio", "plurianual"] as const) {
      const period = presetPeriod(preset, TODAY);
      expect(validatePeriod(period.since, period.until)).toBeNull();
    }
  });

  it("plurianual: desde el 1 de enero de hace 3 años hasta hoy", () => {
    expect(presetPeriod("plurianual", TODAY)).toEqual({ since: "2023-01-01", until: "2026-03-15" });
  });

  it("plurianual: toca los 3 años naturales completos anteriores más el actual (4 años distintos)", () => {
    const period = presetPeriod("plurianual", TODAY);
    const startYear = Number(period.since.slice(0, 4));
    const endYear = Number(period.until.slice(0, 4));
    expect(endYear - startYear).toBe(3);
  });

  it("plurianual: el 31 de diciembre no dispara la validación de longitud (peor caso, ~4 años completos)", () => {
    const endOfYear = new Date("2026-12-31T12:00:00Z");
    const period = presetPeriod("plurianual", endOfYear);
    expect(period).toEqual({ since: "2023-01-01", until: "2026-12-31" });
    expect(validatePeriod(period.since, period.until)).toBeNull();
  });
});

describe("validatePeriod", () => {
  it("acepta un rango válido", () => {
    expect(validatePeriod("2026-01-01", "2026-01-31")).toBeNull();
  });

  it("rechaza since > until", () => {
    expect(validatePeriod("2026-02-01", "2026-01-01")).toBe("rango_invertido");
  });

  it("rechaza un periodo de más de 1461 días", () => {
    expect(validatePeriod("2021-01-01", "2025-01-01")).toBe("periodo_demasiado_largo");
  });

  it("acepta un periodo de exactamente 1461 días", () => {
    expect(validatePeriod("2021-01-02", "2025-01-01")).toBeNull();
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
