import { describe, expect, it } from "vitest";

import {
  CHECKIN_FLAGS,
  enrollmentStatusKey,
  isOpenEnrollment,
  labelOrRaw,
  moodKey,
  trackingTypeKey,
  trackingTypeText,
  urgeKey,
} from "./labels";

describe("trackingTypeText / labelOrRaw", () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? `${key}(${Object.values(values).join("|")})` : key;

  it("traduce el tipo y añade la descripción libre cuando la hay", () => {
    expect(trackingTypeText("alcohol", "", t)).toBe("tracking.type.alcohol");
    expect(trackingTypeText("other", "Pantallas", t)).toBe(
      "entidad.seguimiento.typeWithLabel(tracking.type.other|Pantallas)",
    );
    expect(trackingTypeText("tabaco", "", t)).toBe("tabaco");
  });

  it("cae al valor crudo o a un guion", () => {
    expect(labelOrRaw("tracking.mood.good", "good", t)).toBe("tracking.mood.good");
    expect(labelOrRaw(null, "euforia", t)).toBe("euforia");
    expect(labelOrRaw(null, null, t)).toBe("—");
  });
});

describe("tracking/labels", () => {
  it("traduce cada valor del contrato a su clave", () => {
    expect(trackingTypeKey("gambling")).toBe("tracking.type.gambling");
    expect(enrollmentStatusKey("left")).toBe("tracking.status.left");
    expect(moodKey("so_so")).toBe("tracking.mood.soSo");
    expect(urgeKey("a_lot")).toBe("tracking.urge.aLot");
  });

  it("devuelve null con un valor desconocido, vacío o heredado de Object", () => {
    expect(trackingTypeKey("tabaco")).toBeNull();
    expect(moodKey(null)).toBeNull();
    expect(urgeKey(undefined)).toBeNull();
    expect(enrollmentStatusKey("")).toBeNull();
    expect(moodKey("toString")).toBeNull();
  });

  it("solo pending/active están abiertas", () => {
    expect(isOpenEnrollment("pending")).toBe(true);
    expect(isOpenEnrollment("active")).toBe(true);
    expect(isOpenEnrollment("left")).toBe(false);
    expect(isOpenEnrollment("closed")).toBe(false);
  });

  it("las casillas compartidas nunca incluyen la nota", () => {
    expect(CHECKIN_FLAGS.map(([field]) => field)).not.toContain("note");
    expect(CHECKIN_FLAGS).toHaveLength(9);
  });
});
