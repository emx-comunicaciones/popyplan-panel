"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCompare, type CompareGroupBy } from "@/hooks/useCompare";
import { useMetrics, type MetricsGroupBy } from "@/hooks/useMetrics";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

import { ComparativaTable } from "./ComparativaTable";
import { ExportPanel } from "./ExportPanel";
import { MetricsTable } from "./MetricsTable";
import { PeriodSelector } from "./PeriodSelector";
import { SeriesChart } from "./SeriesChart";
import { StatCard } from "./StatCard";

type TableGroupBy = Extract<MetricsGroupBy, "place" | "organization">;

const GROUP_BY_OPTIONS: { value: TableGroupBy; label: string }[] = [
  { value: "place", label: "Territorio" },
  { value: "organization", label: "Entidad" },
];

type PlataformaCompareGroupBy = Extract<CompareGroupBy, "comarca" | "province" | "organization">;

const COMPARE_GROUP_BY_OPTIONS: { value: PlataformaCompareGroupBy; label: string }[] = [
  { value: "province", label: "Provincia" },
  { value: "comarca", label: "Comarca" },
  { value: "organization", label: "Entidad" },
];

/**
 * Métricas de plataforma (`docs/PANEL.md` §1, ámbito `scope_plataforma`:
 * toda la plataforma, nunca nominal). A diferencia del panel de
 * paraguas, aquí un selector decide si la única tabla de desglose agrupa
 * por territorio (`group_by=place`) o por entidad
 * (`group_by=organization`) — nunca las dos a la vez.
 *
 * **Comparativa** (`docs/PANEL.md` §11, tarea B2): bloque nuevo bajo la
 * serie, `useCompare` con `group_by` por defecto `province` (la
 * plataforma compara provincias) y un `<select>` para cambiar a
 * «Comarca»/«Entidad». **Memoria plurianual**: al elegir el preset
 * «Plurianual» en el selector de periodo, la serie pasa de
 * `group_by=month` a `group_by=year`, y la exportación gana la opción
 * «Por año» (`ExportPanel.tsx`).
 */
export function PlataformaMetricsDashboard() {
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [period, setPeriod] = useState<Period>(() => presetPeriod("mes"));
  const [groupBy, setGroupBy] = useState<TableGroupBy>("place");
  const [compareGroupBy, setCompareGroupBy] = useState<PlataformaCompareGroupBy>("province");
  const compareSelectId = useId();

  function handlePeriodChange(next: Period, nextPreset: PeriodPreset) {
    setPeriod(next);
    setPreset(nextPreset);
  }

  const seriesGroupBy = preset === "plurianual" ? "year" : "month";
  const seriesHeading = preset === "plurianual" ? "Serie anual" : "Serie mensual";
  const seriesEmptyTitle =
    preset === "plurianual"
      ? "Sin datos suficientes para la serie anual"
      : "Sin datos suficientes para la serie mensual";

  const base = useMetrics("plataforma", undefined, period);
  const grouped = useMetrics("plataforma", undefined, period, groupBy);
  const series = useMetrics("plataforma", undefined, period, seriesGroupBy);
  const compare = useCompare("plataforma", undefined, period, compareGroupBy);

  return (
    <div className="flex flex-col gap-6">
      <PeriodSelector value={period} preset={preset} onChange={handlePeriodChange} />

      {base.isError ? (
        <ErrorState title="No se pudieron cargar las métricas" description={base.error.message} />
      ) : !base.data ? (
        <p className="text-sm text-text-secondary">Cargando métricas…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Personas activas"
              value={formatCount(base.data.people.active, base.data.people.suppressed)}
            />
            <StatCard
              label="Altas"
              value={formatCount(base.data.people.new, base.data.people.suppressed)}
            />
            <StatCard
              label="Repetición"
              value={formatCount(base.data.people.repeating, base.data.people.suppressed)}
            />
            <StatCard label="Actividades celebradas" value={formatCount(base.data.events.held, false)} />
            <StatCard
              label="Actividades canceladas"
              value={formatCount(base.data.events.cancelled, false)}
            />
            <StatCard
              label="Asistencia"
              value={formatPct(base.data.attendance.rate, base.data.attendance.suppressed)}
            />
            <StatCard
              label="No-shows"
              value={formatCount(base.data.attendance.no_show, base.data.attendance.suppressed)}
            />
          </div>

          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="text-sm font-medium text-text-form">Agrupar por</legend>
            {GROUP_BY_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={groupBy === option.value ? "primary" : "secondary"}
                aria-pressed={groupBy === option.value}
                onClick={() => setGroupBy(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </fieldset>

          <section aria-labelledby="metrics-table-heading">
            <h2 id="metrics-table-heading" className="mb-2 text-lg font-semibold text-text-base">
              {groupBy === "place" ? "Por municipio" : "Por entidad"}
            </h2>
            {grouped.isError ? (
              <ErrorState
                title="No se pudo cargar el desglose"
                description={grouped.error.message}
              />
            ) : grouped.data && grouped.data.by_place.length > 0 ? (
              <MetricsTable
                caption={groupBy === "place" ? "Métricas por municipio" : "Métricas por entidad"}
                rows={grouped.data.by_place}
                nameHeader={groupBy === "place" ? "Municipio" : "Entidad"}
                codeHeader={groupBy === "place" ? "Código INE" : undefined}
              />
            ) : (
              <EmptyState title="Sin datos para este periodo" />
            )}
          </section>

          <section aria-labelledby="serie-mensual-heading">
            <h2 id="serie-mensual-heading" className="mb-2 text-lg font-semibold text-text-base">
              {seriesHeading}
            </h2>
            {series.isError ? (
              <ErrorState
                title="No se pudo cargar la serie"
                description={series.error.message}
              />
            ) : series.data && series.data.series.length > 0 ? (
              <SeriesChart data={series.data.series} />
            ) : (
              <EmptyState title={seriesEmptyTitle} />
            )}
          </section>

          <section aria-labelledby="comparativa-heading">
            <h2 id="comparativa-heading" className="mb-2 text-lg font-semibold text-text-base">
              Comparativa
            </h2>
            <div className="mb-3">
              <label
                htmlFor={compareSelectId}
                className="mb-1 block text-sm font-medium text-text-form"
              >
                Desglose de la comparativa
              </label>
              <select
                id={compareSelectId}
                value={compareGroupBy}
                onChange={(event) =>
                  setCompareGroupBy(event.target.value as PlataformaCompareGroupBy)
                }
                className="rounded-md border border-border px-2 py-1 text-sm text-text-base focus-visible:outline-primary-700"
              >
                {COMPARE_GROUP_BY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {compare.isError ? (
              <ErrorState
                title="No se pudo cargar la comparativa"
                description={compare.error.message}
              />
            ) : compare.data && compare.data.rows.length > 0 ? (
              <ComparativaTable data={compare.data} />
            ) : (
              <EmptyState title="Sin datos para esta comparativa" />
            )}
          </section>

          {/* El periodo lo manda este dashboard: el selector del panel de
              exportación es el mismo estado, no uno propio — antes se podía
              exportar un rango distinto del que se estaba mirando. */}
          <ExportPanel
            scope="plataforma"
            groupBy={groupBy}
            period={period}
            preset={preset}
            onPeriodChange={handlePeriodChange}
          />
        </>
      )}
    </div>
  );
}
