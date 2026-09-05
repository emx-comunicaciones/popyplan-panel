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
  /** Filas `series` (`group_by=month`, `docs/PANEL.md` §1.4). */
  data: SeriesRow[];
}

interface ChartPoint {
  month: string;
  events: number;
  people: number | null;
}

function toChartData(rows: SeriesRow[]): ChartPoint[] {
  return rows.map((row) => ({
    month: row.month,
    events: row.events,
    people: row.suppressed ? null : row.people,
  }));
}

/** Serie mensual de eventos celebrados y personas distintas (con supresión). */
export function SeriesChart({ data }: SeriesChartProps) {
  const chartData = toChartData(data);

  return (
    <div role="img" aria-label="Serie mensual de eventos y personas" style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="month" stroke="var(--color-text-secondary)" />
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
