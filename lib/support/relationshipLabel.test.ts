import { describe, expect, it } from "vitest";

import { RELATIONSHIP_LABELS, relationshipLabel } from "./relationshipLabel";

describe("relationshipLabel", () => {
  it.each(Object.entries(RELATIONSHIP_LABELS))("etiqueta '%s' como '%s'", (value, label) => {
    expect(relationshipLabel(value)).toBe(label);
  });

  it("reserva al valor crudo si el backend añade una relación nueva", () => {
    expect(relationshipLabel("mentor")).toBe("mentor");
  });
});
