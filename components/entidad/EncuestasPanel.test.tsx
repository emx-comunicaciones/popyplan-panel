import { describe, expect, it } from "vitest";

import { isSurveyOpen } from "./EncuestasPanel";

describe("isSurveyOpen", () => {
  const now = new Date("2026-09-15T12:00:00Z");

  it("todavía no ha abierto", () => {
    expect(isSurveyOpen({ opens_at: "2026-09-20T00:00:00Z", closes_at: null }, now)).toBe(false);
  });

  it("abierta sin fecha de cierre", () => {
    expect(isSurveyOpen({ opens_at: "2026-09-01T00:00:00Z", closes_at: null }, now)).toBe(true);
  });

  it("abierta dentro de la ventana", () => {
    expect(
      isSurveyOpen({ opens_at: "2026-09-01T00:00:00Z", closes_at: "2026-09-30T00:00:00Z" }, now),
    ).toBe(true);
  });

  it("ya cerrada", () => {
    expect(
      isSurveyOpen({ opens_at: "2026-09-01T00:00:00Z", closes_at: "2026-09-10T00:00:00Z" }, now),
    ).toBe(false);
  });
});
