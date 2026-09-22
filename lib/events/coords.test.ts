import { describe, expect, it } from "vitest";

import { formatCoordinateForApi } from "./coords";

describe("formatCoordinateForApi", () => {
  it("formatea con 6 decimales", () => {
    expect(formatCoordinateForApi(43.337753)).toBe("43.337753");
  });

  it("redondea el arrastre de coma flotante a 6 decimales", () => {
    expect(formatCoordinateForApi(0.1 + 0.2)).toBe("0.300000");
  });

  it("acepta negativos", () => {
    expect(formatCoordinateForApi(-1.9812)).toBe("-1.981200");
  });

  it("recorta decimales si la parte entera tiene demasiados dígitos", () => {
    // 4 dígitos enteros -> como mucho 5 decimales para no pasar de 9 en total.
    expect(formatCoordinateForApi(1234.123456789)).toBe("1234.12346");
  });

  it("un valor no finito cae a 0.000000", () => {
    expect(formatCoordinateForApi(NaN)).toBe("0.000000");
    expect(formatCoordinateForApi(Infinity)).toBe("0.000000");
  });
});
