import { describe, expect, it } from "vitest";

import { buildSeriesRows, buildYearSeriesRows } from "@/test-utils/fixtures/metrics";
import { render, screen } from "@/test-utils/render";

import { SeriesChart } from "./SeriesChart";

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
});
