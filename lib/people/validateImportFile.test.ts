import { describe, expect, it } from "vitest";

import { IMPORT_MAX_MB, extensionOf, validateImportFile } from "./validateImportFile";

describe("extensionOf", () => {
  it("extrae la extensión en minúsculas", () => {
    expect(extensionOf("Personas.CSV")).toBe("csv");
  });

  it("sin punto, devuelve cadena vacía", () => {
    expect(extensionOf("personas")).toBe("");
  });

  it("un punto final, devuelve cadena vacía", () => {
    expect(extensionOf("personas.")).toBe("");
  });
});

describe("validateImportFile", () => {
  it("un .csv dentro del límite es válido", () => {
    expect(validateImportFile({ name: "personas.csv", size: 1024 })).toBeNull();
  });

  it("un .xlsx dentro del límite es válido", () => {
    expect(validateImportFile({ name: "personas.xlsx", size: 1024 })).toBeNull();
  });

  it("una extensión no permitida da error", () => {
    expect(validateImportFile({ name: "personas.pdf", size: 1024 })).toMatch(/Tipo de fichero no permitido/);
  });

  it("un fichero que supera el límite da error", () => {
    const oversized = IMPORT_MAX_MB * 1024 * 1024 + 1;
    expect(validateImportFile({ name: "personas.csv", size: oversized })).toBe(
      `El fichero supera el límite de ${IMPORT_MAX_MB} MB.`,
    );
  });
});
