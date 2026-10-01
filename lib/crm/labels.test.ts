import { describe, expect, it } from "vitest";

import { CRM_INTEREST_LABELS, CRM_LOST_REASONS, crmLabel, interestLevel } from "./labels";

describe("etiquetas del CRM", () => {
  const t = (key: string) => `T:${key}`;

  it("traduce por mapa y cae al valor crudo si no lo conoce", () => {
    expect(crmLabel(CRM_INTEREST_LABELS, "high", t)).toBe("T:crm.enums.interest.high");
    expect(crmLabel(CRM_INTEREST_LABELS, "nuevo", t)).toBe("nuevo");
    expect(crmLabel(CRM_INTEREST_LABELS, null, t)).toBe("");
  });

  it("nivel de interés de 0 a 5", () => {
    expect(interestLevel("unrated")).toBe(0);
    expect(interestLevel("very_high")).toBe(5);
    expect(interestLevel(null)).toBe(0);
    expect(interestLevel("raro")).toBe(0);
    expect(CRM_LOST_REASONS).toContain("no_budget");
  });
});
