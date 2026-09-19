import { describe, expect, it } from "vitest";

import {
  REASON_LABELS,
  STATUS_LABELS,
  reasonLabel,
  reasonLabelKey,
  statusLabel,
  statusLabelKey,
} from "./labels";

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

describe("claves de traducción de reportes (tarea 4 de i18n)", () => {
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
