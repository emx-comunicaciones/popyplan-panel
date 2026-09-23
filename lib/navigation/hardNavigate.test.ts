import { describe, expect, it, vi } from "vitest";

import { hardNavigate } from "./hardNavigate";

describe("hardNavigate", () => {
  it("navega con una petición de documento completa", () => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      assign,
    } as unknown as Location);

    hardNavigate("/entidad/asociacion-bidasoa");

    expect(assign).toHaveBeenCalledWith("/entidad/asociacion-bidasoa");
  });
});
