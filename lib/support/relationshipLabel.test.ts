import { describe, expect, it } from "vitest";

import { RELATIONSHIP_LABEL_KEYS, relationshipLabelKey } from "./relationshipLabel";

describe("relationshipLabelKey", () => {
  it.each(Object.entries(RELATIONSHIP_LABEL_KEYS))("'%s' resuelve a la clave '%s'", (value, key) => {
    expect(relationshipLabelKey(value)).toBe(key);
  });

  it("devuelve null si el backend añade una relación nueva", () => {
    expect(relationshipLabelKey("mentor")).toBeNull();
  });
});
