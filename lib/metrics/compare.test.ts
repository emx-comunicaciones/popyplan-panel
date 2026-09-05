import { describe, expect, it } from "vitest";

import { formatDeltaCount, formatDeltaPct, groupByLabel, previousPeriodLabel } from "./compare";

describe("formatDeltaCount", () => {
  it("positivo lleva signo +", () => {
    expect(formatDeltaCount(4, false)).toBe("+4");
  });

  it("negativo lleva signo -", () => {
    expect(formatDeltaCount(-2, false)).toBe("-2");
  });

  it("cero se pinta sin signo", () => {
    expect(formatDeltaCount(0, false)).toBe("0");
  });

  it("miles con separador es-ES", () => {
    expect(formatDeltaCount(1284, false)).toBe("+1.284");
  });

  it("suprimido es «—», nunca «<5» (una diferencia suprimida no es «menos de 5»)", () => {
    expect(formatDeltaCount(null, true)).toBe("—");
  });

  it("value null sin suppressed también es «—» (defensivo)", () => {
    expect(formatDeltaCount(null, false)).toBe("—");
  });
});

describe("formatDeltaPct", () => {
  it("positivo lleva signo + y símbolo %", () => {
    expect(formatDeltaPct(0.05, false)).toBe("+5,0 %");
  });

  it("negativo lleva signo -", () => {
    expect(formatDeltaPct(-0.02, false)).toBe("-2,0 %");
  });

  it("cero se pinta sin signo", () => {
    expect(formatDeltaPct(0, false)).toBe("0,0 %");
  });

  it("suprimido es «—»", () => {
    expect(formatDeltaPct(null, true)).toBe("—");
  });
});

describe("previousPeriodLabel", () => {
  it("formatea «frente a 1 ene – 31 mar 2026» (ejemplo del brief)", () => {
    expect(previousPeriodLabel({ since: "2026-01-01", until: "2026-03-31" })).toBe(
      "frente a 1 ene – 31 mar 2026",
    );
  });

  it("otro rango, otro año", () => {
    expect(previousPeriodLabel({ since: "2025-12-31", until: "2026-03-31" })).toBe(
      "frente a 31 dic – 31 mar 2026",
    );
  });
});

describe("groupByLabel", () => {
  it("traduce los cuatro desgloses conocidos", () => {
    expect(groupByLabel("comarca")).toBe("comarca");
    expect(groupByLabel("organization")).toBe("entidad");
    expect(groupByLabel("place")).toBe("municipio");
    expect(groupByLabel("province")).toBe("provincia");
  });

  it("un desglose desconocido se devuelve tal cual (defensivo)", () => {
    expect(groupByLabel("otro")).toBe("otro");
  });
});
