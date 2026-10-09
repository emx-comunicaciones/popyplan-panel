import { describe, expect, it } from "vitest";

import { ALL_VISIBILITIES, VISIBILITY_LABEL_KEY, visibilityOptions } from "./visibility";

describe("visibilityOptions", () => {
  it("el espacio de miembros ofrece las cuatro", () => {
    expect(visibilityOptions("members")).toEqual(["open", "on_request", "private_listed", "private"]);
    expect(visibilityOptions(undefined, "open")).toEqual([...ALL_VISIBILITIES]);
  });

  it("el de familias solo «Privada»", () => {
    expect(visibilityOptions("families")).toEqual(["private"]);
    expect(visibilityOptions("families", "private")).toEqual(["private"]);
  });

  it("una de familias antigua y abierta conserva la suya y puede pasar a «Privada»", () => {
    expect(visibilityOptions("families", "on_request")).toEqual(["on_request", "private"]);
  });

  it("cada visibilidad tiene su texto", () => {
    for (const v of ALL_VISIBILITIES) expect(VISIBILITY_LABEL_KEY[v]).toMatch(/^entidad\.familias\./);
  });
});
