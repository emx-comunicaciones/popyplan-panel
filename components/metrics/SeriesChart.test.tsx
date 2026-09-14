import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SeriesRow } from "@/lib/api/types";
import { buildSeriesRows, buildYearSeriesRows } from "@/test-utils/fixtures/metrics";
import { render, screen } from "@/test-utils/render";

import { formatSeriesTooltipValue, SeriesChart } from "./SeriesChart";

describe("SeriesChart", () => {
  it("serie mensual: aria-label «Serie mensual…»", () => {
    render(<SeriesChart data={buildSeriesRows()} />);

    expect(screen.getByRole("img", { name: "Serie mensual de eventos y personas" })).toBeInTheDocument();
  });

  it("serie anual (group_by=year): aria-label «Serie anual…» en vez de «Serie mensual…»", () => {
    render(<SeriesChart data={buildYearSeriesRows()} />);

    expect(screen.getByRole("img", { name: "Serie anual de eventos y personas" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Serie mensual de eventos y personas" })).not.toBeInTheDocument();
  });

  it("sin filas: no revienta, sigue siendo mensual por defecto", () => {
    render(<SeriesChart data={[]} />);

    expect(screen.getByRole("img", { name: "Serie mensual de eventos y personas" })).toBeInTheDocument();
  });

  it("tooltip al pasar el ratón: los valores reales llegan formateados por `formatSeriesTooltipValue`", async () => {
    // El `ResponsiveContainer` mockeado en `vitest.setup.ts` inyecta
    // 400×280, así que el `<svg>` sí pinta en jsdom y el hover sobre él
    // activa el tooltip real de recharts (que se renderiza en el frame
    // siguiente vía `requestAnimationFrame`, de ahí la espera).
    const rows: SeriesRow[] = [
      { month: "2026-01", events: 4, people: 8, suppressed: false },
      { month: "2026-02", events: 1234, people: 8, suppressed: false },
      { month: "2026-03", events: 1, people: 8, suppressed: false },
    ];
    const { container } = render(<SeriesChart data={rows} />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    fireEvent.mouseMove(svg!, { clientX: 200, clientY: 100 });
    await waitFor(() => {
      expect(container.querySelector(".recharts-default-tooltip")).not.toBeNull();
    });

    const tooltip = container.querySelector(".recharts-default-tooltip");
    // 1234 eventos en el punto central: formateado con separador de
    // miles («1.234»), nunca crudo.
    expect(tooltip).toHaveTextContent("1.234");
  });
});

describe("formatSeriesTooltipValue", () => {
  it("«<5» solo cuando el punto está suprimido (grupo <5 personas distintas)", () => {
    expect(formatSeriesTooltipValue(null, { suppressed: true })).toBe("<5");
    expect(formatSeriesTooltipValue(undefined, { suppressed: true })).toBe("<5");
  });

  it("«—» cuando falta el dato sin supresión (misma regla que `formatCount`)", () => {
    expect(formatSeriesTooltipValue(null, { suppressed: false })).toBe("—");
    expect(formatSeriesTooltipValue(undefined, { suppressed: false })).toBe("—");
    // Sin payload (defensivo): tampoco es «<5».
    expect(formatSeriesTooltipValue(null)).toBe("—");
  });

  it("valor real: formateado con separador de miles", () => {
    expect(formatSeriesTooltipValue(1234, { suppressed: false })).toBe("1.234");
    expect(formatSeriesTooltipValue(8, { suppressed: true })).toBe("8");
  });
});
