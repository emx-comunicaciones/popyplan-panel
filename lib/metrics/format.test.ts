import { describe, expect, it } from "vitest";

import { formatCount, formatPct } from "./format";

describe("formatCount", () => {
  it("separa los miles con punto (locale es-ES)", () => {
    expect(formatCount(1284)).toBe("1.284");
  });

  it("no separa un número pequeño", () => {
    expect(formatCount(4)).toBe("4");
  });

  it("suppressed → '<5', aunque el value no sea null", () => {
    expect(formatCount(3, true)).toBe("<5");
    expect(formatCount(null, true)).toBe("<5");
  });

  it("value null sin suppressed → '—'", () => {
    expect(formatCount(null)).toBe("—");
  });
});

describe("formatPct", () => {
  it("formatea con coma decimal y símbolo de porcentaje", () => {
    expect(formatPct(0.75)).toBe("75,0 %");
  });

  it("redondea a un decimal", () => {
    expect(formatPct(0.7272727272727273)).toBe("72,7 %");
  });

  it("suppressed → '<5'", () => {
    expect(formatPct(null, true)).toBe("<5");
  });

  it("value null sin suppressed → '—' (denominador 0, docs/PANEL.md §1.4)", () => {
    expect(formatPct(null)).toBe("—");
  });
});
