import { describe, expect, it } from "vitest";

import { REASON_LABELS, STATUS_LABELS, reasonLabel, statusLabel } from "./labels";

describe("etiquetas de reportes", () => {
  it("traduce los motivos del contrato", () => {
    expect(reasonLabel("harassment")).toBe("Acoso");
    expect(reasonLabel("self_harm_risk")).toBe("Riesgo de autolesión");
    expect(Object.keys(REASON_LABELS)).toHaveLength(8);
  });

  it("traduce los estados del contrato", () => {
    expect(statusLabel("pending")).toBe("Pendiente");
    expect(statusLabel("in_review")).toBe("En revisión");
    expect(statusLabel("resolved")).toBe("Resuelto");
    expect(Object.keys(STATUS_LABELS)).toHaveLength(3);
  });

  it("un valor que el panel no conoce se pinta tal cual, nunca en blanco", () => {
    expect(reasonLabel("valor_nuevo_del_backend")).toBe("valor_nuevo_del_backend");
    expect(statusLabel("valor_nuevo_del_backend")).toBe("valor_nuevo_del_backend");
  });
});
