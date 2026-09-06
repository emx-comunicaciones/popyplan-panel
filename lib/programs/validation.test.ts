import { describe, expect, it } from "vitest";

import { PROGRAM_ENDS_ON_ERROR, validateProgramDates } from "./validation";

describe("validateProgramDates", () => {
  it("acepta un rango válido (fin posterior a inicio)", () => {
    expect(validateProgramDates("2026-01-01", "2026-06-30")).toBeNull();
  });

  it("acepta fin igual a inicio (un programa de un solo día)", () => {
    expect(validateProgramDates("2026-01-01", "2026-01-01")).toBeNull();
  });

  it("rechaza fin anterior a inicio con el mensaje literal del backend", () => {
    expect(validateProgramDates("2026-06-30", "2026-01-01")).toBe(PROGRAM_ENDS_ON_ERROR);
  });

  it("sin alguna de las dos fechas, no valida todavía (otro control exige rellenarlas)", () => {
    expect(validateProgramDates("", "2026-01-01")).toBeNull();
    expect(validateProgramDates("2026-01-01", "")).toBeNull();
  });
});
