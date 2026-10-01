import { describe, expect, it } from "vitest";

import { daysAgo, formatDate, formatDateTime, formatMoney, fromLocalInput, toLocalInput } from "./format";

describe("formatos del CRM", () => {
  it("importes en euros, sin decimales si son enteros", () => {
    expect(formatMoney("8000.00")).toMatch(/^8\.?000\s€$/);
    expect(formatMoney("96000")).toMatch(/^96\.000\s€$/);
    expect(formatMoney(7500.5)).toMatch(/^7\.?500,5/);
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney("")).toBe("—");
    expect(formatMoney("abc")).toBe("—");
  });

  it("fechas, también sin hora, y vacíos", () => {
    expect(formatDate("2026-10-04")).toMatch(/4/);
    expect(formatDate(null)).toBe("—");
    expect(formatDate("no")).toBe("—");
    expect(formatDateTime("2026-10-04T09:00:00Z")).toMatch(/2026/);
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("no")).toBe("—");
  });

  it("días transcurridos", () => {
    const now = new Date("2026-10-06T10:00:00Z");
    expect(daysAgo("2026-10-01T10:00:00Z", now)).toBe(5);
    expect(daysAgo(null, now)).toBeNull();
    expect(daysAgo("no", now)).toBeNull();
    expect(daysAgo("2020-01-01T10:00:00Z")).toBeGreaterThan(0);
  });

  it("ida y vuelta con datetime-local", () => {
    const iso = "2026-10-04T09:30:00.000Z";
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(null)).toBe("");
    expect(toLocalInput("no")).toBe("");
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("no")).toBeNull();
  });
});
