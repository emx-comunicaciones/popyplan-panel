import { describe, expect, it } from "vitest";

import { isValidFiscalId, normalizeFiscalId } from "./fiscalId";

describe("isValidFiscalId (mismo criterio que entities/validators.py)", () => {
  it.each(["G12345674", "G1234567D", "B76676683", "B76676683".toLowerCase(), "b-7667668 3", "P2000000F", "12345678Z", "X1234567L", "K1234567L"])(
    "acepta %s",
    (valor) => expect(isValidFiscalId(valor)).toBe(true),
  );

  it.each(["", "G12345678", "B76676689", "P20000000", "A1234567J", "12345678A", "X1234567A", "ZZZ"])(
    "rechaza %s",
    (valor) => expect(isValidFiscalId(valor)).toBe(false),
  );

  it("normaliza a mayúsculas sin espacios, guiones ni puntos", () => {
    expect(normalizeFiscalId(" g-1234.567 4 ")).toBe("G12345674");
  });
});
