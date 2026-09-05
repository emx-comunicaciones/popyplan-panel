"use client";

import { useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useMetrics } from "@/hooks/useMetrics";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

import { MetricsTable } from "./MetricsTable";
import { PeriodSelector } from "./PeriodSelector";
import { SeriesChart } from "./SeriesChart";
import { StatCard } from "./StatCard";

export interface ParaguasMetricsDashboardProps {
  orgId: number | string;
  orgName: string;
}

/**
 * Inicio del panel de paraguas (`docs/PANEL.md` §1, ámbito
 * `scope_paraguas`: la entidad paraguas y todas sus hijas recursivas,
 * nunca nominal). El esquema fijo solo rellena uno de
 * `by_place`/`by_weekday_hour`/`series` por petición (`group_by`), así
 * que la tabla «Por municipio» (`group_by=place`), la tabla «Por
 * entidad» (`group_by=organization`) y el gráfico de la serie mensual
 * (`group_by=month`) son tres peticiones aparte de la base (sin
 * `group_by`, para las tarjetas).
 */
export function ParaguasMetricsDashboard({ orgId, orgName }: ParaguasMetricsDashboardProps) {
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [period, setPeriod] = useState<Period>(() => presetPeriod("mes"));

  function handlePeriodChange(next: Period, nextPreset: PeriodPreset) {
    setPeriod(next);
    setPreset(nextPreset);
  }

  const base = useMetrics("paraguas", orgId, period);
  const byMunicipio = useMetrics("paraguas", orgId, period, "place");
  const byEntidad = useMetrics("paraguas", orgId, period, "organization");
  const series = useMetrics("paraguas", orgId, period, "month");

  return (
    <div className="flex flex-col gap-6">
      <PeriodSelector value={period} preset={preset} onChange={handlePeriodChange} />

      {base.isError ? (
        <ErrorState
          title="No se pudieron cargar las métricas"
          description={base.error.message}
        />
      ) : !base.data ? (
        <p className="text-sm text-text-secondary">Cargando métricas de {orgName}…</p>
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
            <StatCard
              label="Actividades celebradas"
              value={formatCount(base.data.events.held, false)}
            />
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

          <section aria-labelledby="por-municipio-heading">
            <h2 id="por-municipio-heading" className="mb-2 text-lg font-semibold text-text-base">
              Por municipio
            </h2>
            {byMunicipio.data && byMunicipio.data.by_place.length > 0 ? (
              <MetricsTable
                caption="Métricas por municipio"
                rows={byMunicipio.data.by_place}
                nameHeader="Municipio"
                codeHeader="Código INE"
              />
            ) : (
              <EmptyState title="Sin municipios con datos en este periodo" />
            )}
          </section>

          <section aria-labelledby="por-entidad-heading">
            <h2 id="por-entidad-heading" className="mb-2 text-lg font-semibold text-text-base">
              Por entidad
            </h2>
            {byEntidad.data && byEntidad.data.by_place.length > 0 ? (
              <MetricsTable
                caption="Métricas por entidad"
                rows={byEntidad.data.by_place}
                nameHeader="Entidad"
              />
            ) : (
              <EmptyState title="Sin entidades con datos en este periodo" />
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
        </>
      )}
    </div>
  );
}
