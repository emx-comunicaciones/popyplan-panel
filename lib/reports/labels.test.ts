import { describe, expect, it } from "vitest";

import { REASON_LABEL_KEYS, STATUS_LABEL_KEYS, reasonLabelKey, statusLabelKey } from "./labels";

describe("claves de traducción de reportes (tarea 4 de i18n, puente cerrado en la tarea 5)", () => {
  it("REASON_LABEL_KEYS/STATUS_LABEL_KEYS cubren los motivos y estados del contrato", () => {
    expect(Object.keys(REASON_LABEL_KEYS)).toHaveLength(8);
    expect(Object.keys(STATUS_LABEL_KEYS)).toHaveLength(3);
  });

  it("reasonLabelKey devuelve la clave de cada motivo del contrato", () => {
    expect(reasonLabelKey("harassment")).toBe("reports.reason.harassment");
    expect(reasonLabelKey("self_harm_risk")).toBe("reports.reason.selfHarmRisk");
  });

  it("statusLabelKey devuelve la clave de cada estado del contrato", () => {
    expect(statusLabelKey("pending")).toBe("reports.status.pending");
    expect(statusLabelKey("in_review")).toBe("reports.status.inReview");
    expect(statusLabelKey("resolved")).toBe("reports.status.resolved");
  });

  it("un valor que el panel no conoce da null, nunca una clave inventada", () => {
    expect(reasonLabelKey("valor_nuevo_del_backend")).toBeNull();
    expect(statusLabelKey("valor_nuevo_del_backend")).toBeNull();
  });
});
