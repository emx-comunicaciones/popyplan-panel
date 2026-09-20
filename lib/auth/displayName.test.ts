import { describe, expect, it } from "vitest";

import { displayName } from "./displayName";

describe("displayName", () => {
  it("une nombre y apellidos", () => {
    expect(displayName({ first_name: "Ana", last_name: "Gómez" })).toBe("Ana Gómez");
  });

  it("aguanta que falte una de las dos partes, o que vengan con espacios", () => {
    expect(displayName({ first_name: " Ana ", last_name: "" })).toBe("Ana");
    expect(displayName({ last_name: "Gómez" })).toBe("Gómez");
  });

  it("sin ninguna parte devuelve null (se enseña solo el email)", () => {
    expect(displayName({})).toBeNull();
    expect(displayName({ first_name: "  ", last_name: null })).toBeNull();
  });
});
