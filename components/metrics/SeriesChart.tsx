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
  /** `true` cuando `people` es `null` por supresión (grupo <5), no por falta de dato. */
  suppressed: boolean;
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
    suppressed: row.suppressed,
  }));
}

/**
 * Formatea un valor del tooltip de la serie. `people: null` puede ser
 * supresión (grupo <5 personas distintas → «<5») o sin dato («—»): solo
 * el primer caso es «<5», con la misma regla que
 * `lib/metrics/format.ts::formatCount`. Exportada para testear la
 * distinción: recharts no pinta en el tooltip las entradas con valor
 * `null`, así que en jsdom no hay hover que la ejercite.
 */
export function formatSeriesTooltipValue(
  value: number | string | null | undefined,
  point?: Pick<ChartPoint, "suppressed">,
): string {
  if (value === null || value === undefined) return point?.suppressed ? "<5" : "—";
  return formatCount(typeof value === "number" ? value : Number(value), false);
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
            formatter={(value, _name, item) =>
              // recharts tipa `ValueType` como `number | string | readonly
              // (string | number)[]`; el formateador solo recibe escalares.
              formatSeriesTooltipValue(
                value as number | string | null | undefined,
                item?.payload as ChartPoint | undefined,
              )
            }
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
