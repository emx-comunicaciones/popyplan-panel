import { describe, expect, it } from "vitest";

import { nextStepOrder, parseCoordinate, validateGameImage, validatePrizeTier, validateStep } from "./validation";

describe("validatePrizeTier", () => {
  const tiers = [
    { id: "a", rank_from: 1, rank_to: 1 },
    { id: "b", rank_from: 2, rank_to: 5 },
  ];

  it("acepta un tramo libre", () => {
    expect(validatePrizeTier(6, 10, tiers)).toBeNull();
  });

  it("rechaza posiciones no enteras o por debajo de 1", () => {
    expect(validatePrizeTier(0, 2, tiers)).toBe("rango_invalido");
    expect(validatePrizeTier(1.5, 2, tiers)).toBe("rango_invalido");
    expect(validatePrizeTier(Number.NaN, 2, tiers)).toBe("rango_invalido");
  });

  it("rechaza desde > hasta", () => {
    expect(validatePrizeTier(8, 6, tiers)).toBe("desde_mayor");
  });

  it("detecta solapes como el backend, excluyendo el tramo que se edita", () => {
    expect(validatePrizeTier(5, 7, tiers)).toBe("solapa");
    expect(validatePrizeTier(1, 1, tiers)).toBe("solapa");
    expect(validatePrizeTier(2, 4, tiers, "b")).toBeNull();
  });
});

describe("nextStepOrder", () => {
  it("es uno más que el mayor, 1 sin pruebas", () => {
    expect(nextStepOrder([])).toBe(1);
    expect(nextStepOrder([{ order: 1 }, { order: 4 }])).toBe(5);
  });
});

describe("validateStep", () => {
  const steps = [{ id: "s1", order: 1 }];
  const base = { order: 2, clue: "pista", challengeType: "photo" as const, correctAnswer: "", latitude: "", longitude: "" };

  it("acepta una prueba de foto", () => {
    expect(validateStep(base, steps)).toBeNull();
  });

  it("orden inválido o repetido", () => {
    expect(validateStep({ ...base, order: 0 }, steps)).toBe("orden_invalido");
    expect(validateStep({ ...base, order: 1 }, steps)).toBe("orden_repetido");
    expect(validateStep({ ...base, order: 1 }, steps, "s1")).toBeNull();
  });

  it("sin pista", () => {
    expect(validateStep({ ...base, clue: "  " }, steps)).toBe("sin_pista");
  });

  it("respuesta obligatoria salvo que ya haya una guardada", () => {
    const answer = { ...base, challengeType: "answer" as const };
    expect(validateStep(answer, steps)).toBe("sin_respuesta");
    expect(validateStep(answer, steps, undefined, true)).toBeNull();
    expect(validateStep({ ...answer, correctAnswer: "Peine" }, steps)).toBeNull();
  });

  it("ubicación exige coordenadas válidas", () => {
    const location = { ...base, challengeType: "location" as const };
    expect(validateStep(location, steps)).toBe("sin_coordenadas");
    expect(validateStep({ ...location, latitude: "95", longitude: "1" }, steps)).toBe("coordenadas_invalidas");
    expect(validateStep({ ...location, latitude: "abc", longitude: "1" }, steps)).toBe("coordenadas_invalidas");
    expect(validateStep({ ...location, latitude: "43,3183", longitude: "-1.9812" }, steps)).toBeNull();
  });
});

describe("parseCoordinate", () => {
  it("admite coma decimal y devuelve null si está vacía o no es un número", () => {
    expect(parseCoordinate("43,5")).toBe(43.5);
    expect(parseCoordinate("")).toBeNull();
    expect(parseCoordinate("x")).toBeNull();
  });
});

describe("validateGameImage", () => {
  it("formatos y tamaño", () => {
    expect(validateGameImage({ name: "a.png", size: 100 })).toBeNull();
    expect(validateGameImage({ name: "a.svg", size: 100 })).toBe("tipo_no_permitido");
    expect(validateGameImage({ name: "a.jpg", size: 6 * 1024 * 1024 })).toBe("demasiado_grande");
  });
});
