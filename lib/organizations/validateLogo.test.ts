import { describe, expect, it } from "vitest";

import { LOGO_MAX_MB, validateLogoFile } from "./validateLogo";

describe("validateLogoFile", () => {
  it("acepta png, jpg, jpeg y webp dentro del límite", () => {
    for (const name of ["logo.png", "logo.jpg", "LOGO.JPEG", "logo.webp"]) {
      expect(validateLogoFile({ name, size: 1024 })).toBeNull();
    }
  });

  it("rechaza un SVG (Pillow no lo abre como imagen) y un fichero sin extensión", () => {
    expect(validateLogoFile({ name: "logo.svg", size: 10 })).toBe("tipo_no_permitido");
    expect(validateLogoFile({ name: "logo", size: 10 })).toBe("tipo_no_permitido");
  });

  it("rechaza un fichero por encima de LOGO_MAX_MB", () => {
    const max = LOGO_MAX_MB * 1024 * 1024;
    expect(validateLogoFile({ name: "logo.png", size: max })).toBeNull();
    expect(validateLogoFile({ name: "logo.png", size: max + 1 })).toBe("demasiado_grande");
  });
});
