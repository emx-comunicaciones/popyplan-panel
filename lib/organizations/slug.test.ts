import { describe, expect, it } from "vitest";

import { SLUG_MAX_LENGTH, isValidSlug, slugify } from "./slug";

describe("slugify", () => {
  it("quita tildes y ñ, pasa a minúsculas y une con guiones", () => {
    expect(slugify("Asociación de Adicciones de Errenteria")).toBe("asociacion-de-adicciones-de-errenteria");
    expect(slugify("  Peña  Montañera · Irún!! ")).toBe("pena-montanera-irun");
  });

  it("recorta a la longitud del backend sin dejar un guion al final", () => {
    const largo = slugify("palabra ".repeat(20));
    expect(largo.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(largo.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it("acepta minúsculas, números y guiones sueltos", () => {
    expect(isValidSlug("ayto-irun-2")).toBe(true);
  });

  it.each(["", "Ayto", "ayto irun", "-ayto", "ayto--irun", "a".repeat(SLUG_MAX_LENGTH + 1)])("rechaza %s", (valor) => {
    expect(isValidSlug(valor)).toBe(false);
  });
});
