"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useMetrics, type MetricsGroupBy } from "@/hooks/useMetrics";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

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

/**
 * Métricas de plataforma (`docs/PANEL.md` §1, ámbito `scope_plataforma`:
 * toda la plataforma, nunca nominal). A diferencia del panel de
 * paraguas, aquí un selector decide si la única tabla de desglose agrupa
 * por territorio (`group_by=place`) o por entidad
 * (`group_by=organization`) — nunca las dos a la vez.
 */
export function PlataformaMetricsDashboard() {
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [period, setPeriod] = useState<Period>(() => presetPeriod("mes"));
  const [groupBy, setGroupBy] = useState<TableGroupBy>("place");

  function handlePeriodChange(next: Period, nextPreset: PeriodPreset) {
    setPeriod(next);
    setPreset(nextPreset);
  }

  const base = useMetrics("plataforma", undefined, period);
  const grouped = useMetrics("plataforma", undefined, period, groupBy);
  const series = useMetrics("plataforma", undefined, period, "month");

  return (
    <div className="flex flex-col gap-6">
      <PeriodSelector value={period} preset={preset} onChange={handlePeriodChange} />

      {base.isError ? (
        <ErrorState title="No se pudieron cargar las métricas" description={base.error.message} />
      ) : !base.data ? (
        <p className="text-sm text-text-secondary">Cargando métricas…</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          </dl>

          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="text-sm font-medium text-text-form">Agrupar por</legend>
            {GROUP_BY_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={groupBy === option.value ? "primary" : "secondary"}
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
            {grouped.data && grouped.data.by_place.length > 0 ? (
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
              Serie mensual
            </h2>
            {series.data && series.data.series.length > 0 ? (
              <SeriesChart data={series.data.series} />
            ) : (
              <EmptyState title="Sin datos suficientes para la serie mensual" />
            )}
          </section>

          <ExportPanel scope="plataforma" groupBy={groupBy} />
        </>
      )}
    </div>
  );
}
