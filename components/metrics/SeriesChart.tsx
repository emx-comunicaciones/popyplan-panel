"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SeriesRow } from "@/lib/api/types";
import { formatCount } from "@/lib/metrics/format";

export interface SeriesChartProps {
  /**
   * Filas `series`: `group_by=month` (`docs/PANEL.md` §1.4, campo
   * `month`, `"YYYY-MM"`) o `group_by=year` (memoria plurianual, tarea
   * B2, §11.4, campo `year`, `"YYYY"`) — nunca los dos a la vez, según
   * decida el `group_by` de la petición que llenó `data`.
   */
  data: SeriesRow[];
}

interface ChartPoint {
  label: string;
  events: number;
  people: number | null;
}

/** `true` si esta serie viene de `group_by=year` (todas sus filas llevan `year`, ninguna `month`). */
function isYearSeries(rows: SeriesRow[]): boolean {
  return rows.length > 0 && rows.every((row) => row.year !== undefined);
}

function toChartData(rows: SeriesRow[]): ChartPoint[] {
  return rows.map((row) => ({
    label: row.year ?? row.month ?? "",
    events: row.events,
    people: row.suppressed ? null : row.people,
  }));
}

/**
 * Serie de eventos celebrados y personas distintas (con supresión),
 * mensual o anual según de dónde vengan las filas — la propia serie se
 * etiqueta sola con el año (`"2025"`, `"2026"`…) cuando `series[].year`
 * existe, en vez del mes (`"2026-01"`).
 */
export function SeriesChart({ data }: SeriesChartProps) {
  const chartData = toChartData(data);
  const ariaLabel = isYearSeries(data)
    ? "Serie anual de eventos y personas"
    : "Serie mensual de eventos y personas";

  return (
    <div role="img" aria-label={ariaLabel} style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" stroke="var(--color-text-secondary)" />
          <YAxis stroke="var(--color-text-secondary)" />
          <Tooltip
            formatter={(value) => {
              if (value === null || value === undefined) return "<5";
              const numeric = typeof value === "number" ? value : Number(value);
              return formatCount(numeric, false);
            }}
          />
          <Line type="monotone" dataKey="events" name="Eventos" stroke="var(--color-primary)" />
          <Line
            type="monotone"
            dataKey="people"
            name="Personas"
            stroke="var(--color-secondary-600)"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
