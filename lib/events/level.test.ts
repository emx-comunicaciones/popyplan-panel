import { describe, expect, it } from "vitest";

import { EVENT_LEVELS, levelLabelKey, toEventLevel } from "./level";

describe("nivel de una actividad", () => {
  it("ofrece «todos los niveles» primero y los tres niveles del contrato", () => {
    expect(EVENT_LEVELS).toEqual(["", "beginner", "intermediate", "advanced"]);
  });

  it("cada valor tiene su clave de catálogo; vacío o ausente es «todos los niveles»", () => {
    expect(levelLabelKey("")).toBe("events.levels.all");
    expect(levelLabelKey(null)).toBe("events.levels.all");
    expect(levelLabelKey(undefined)).toBe("events.levels.all");
    expect(levelLabelKey("beginner")).toBe("events.levels.beginner");
    expect(levelLabelKey("intermediate")).toBe("events.levels.intermediate");
    expect(levelLabelKey("advanced")).toBe("events.levels.advanced");
  });

  it("un valor desconocido no tiene clave (se pinta crudo)", () => {
    expect(levelLabelKey("expert")).toBeNull();
  });

  it("normaliza lo que llega del backend al valor del selector", () => {
    expect(toEventLevel("advanced")).toBe("advanced");
    expect(toEventLevel(undefined)).toBe("");
    expect(toEventLevel(null)).toBe("");
    expect(toEventLevel("expert")).toBe("");
  });
});
