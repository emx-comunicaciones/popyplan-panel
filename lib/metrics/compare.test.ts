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

  it("una diferencia negativa que redondea a 0,0 se pinta sin signo", () => {
    // -0.0001 son -0,01 puntos: con una sola décima es 0,0, así que un
    // «-0,0 %» sería ruido (parece una bajada que no existe).
    expect(formatDeltaPct(-0.0001, false)).toBe("0,0 %");
  });

  it("una diferencia positiva que redondea a 0,0 se pinta sin signo", () => {
    expect(formatDeltaPct(0.0004, false)).toBe("0,0 %");
  });

  it("una diferencia que sí llega a una décima conserva su signo", () => {
    expect(formatDeltaPct(-0.0006, false)).toBe("-0,1 %");
    expect(formatDeltaPct(0.0005, false)).toBe("+0,1 %");
  });
});

describe("previousPeriodLabel", () => {
  it("formatea «frente a 1 ene – 31 mar 2026» (ejemplo del brief)", () => {
    expect(previousPeriodLabel({ since: "2026-01-01", until: "2026-03-31" })).toBe(
      "frente a 1 ene – 31 mar 2026",
    );
  });

  it("otro rango, mismo año", () => {
    expect(previousPeriodLabel({ since: "2026-01-02", until: "2026-03-31" })).toBe(
      "frente a 2 ene – 31 mar 2026",
    );
  });

  it("si el periodo anterior cruza el año, la fecha inicial también lleva año («Año»)", () => {
    expect(previousPeriodLabel({ since: "2024-09-17", until: "2025-09-17" })).toBe(
      "frente a 17 sept 2024 – 17 sept 2025",
    );
  });

  it("un periodo anterior de fin de año lleva los dos años", () => {
    expect(previousPeriodLabel({ since: "2025-12-31", until: "2026-03-31" })).toBe(
      "frente a 31 dic 2025 – 31 mar 2026",
    );
  });

  it("un periodo anterior plurianual lleva los dos años", () => {
    expect(previousPeriodLabel({ since: "2019-01-01", until: "2022-12-31" })).toBe(
      "frente a 1 ene 2019 – 31 dic 2022",
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
