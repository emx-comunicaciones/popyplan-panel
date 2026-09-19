"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCompare, type CompareErrorKind, type CompareGroupBy } from "@/hooks/useCompare";
import { useMetrics, type MetricsErrorKind } from "@/hooks/useMetrics";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

import { ComparativaTable } from "./ComparativaTable";
import { MetricsTable } from "./MetricsTable";
import { PeriodSelector } from "./PeriodSelector";
import { SeriesChart } from "./SeriesChart";
import { StatCard } from "./StatCard";

export interface ParaguasMetricsDashboardProps {
  orgId: number | string;
  orgName: string;
}

type ParaguasCompareGroupBy = Extract<CompareGroupBy, "comarca" | "organization" | "place">;

const COMPARE_GROUP_BY_OPTION_KEYS: { value: ParaguasCompareGroupBy; labelKey: string }[] = [
  { value: "comarca", labelKey: "metrics.groupBy.comarca" },
  { value: "organization", labelKey: "metrics.groupBy.organization" },
  { value: "place", labelKey: "metrics.groupBy.place" },
];

const METRICS_ERROR_KEYS: Record<MetricsErrorKind, string> = {
  periodo_invalido: "errors.metrics.periodoInvalido",
  sin_acceso: "errors.metrics.sinAcceso",
  desconocido: "errors.metrics.desconocido",
};

const COMPARE_ERROR_KEYS: Record<CompareErrorKind, string> = {
  periodo_invalido: "errors.compare.periodoInvalido",
  sin_acceso: "errors.compare.sinAcceso",
  desconocido: "errors.compare.desconocido",
};

/**
 * Inicio del panel de paraguas (`docs/PANEL.md` §1, ámbito
 * `scope_paraguas`: la entidad paraguas y todas sus hijas recursivas,
 * nunca nominal). El esquema fijo solo rellena uno de
 * `by_place`/`by_weekday_hour`/`series` por petición (`group_by`), así
 * que la tabla «Por municipio» (`group_by=place`), la tabla «Por
 * entidad» (`group_by=organization`) y el gráfico de la serie mensual
 * (`group_by=month`) son tres peticiones aparte de la base (sin
 * `group_by`, para las tarjetas).
 *
 * **Comparativa** (`docs/PANEL.md` §11, tarea B2): bloque nuevo bajo las
 * tarjetas, `useCompare` con `group_by` por defecto `comarca` (la
 * diputación compara sus comarcas) y un `<select>` para cambiar a
 * «Entidad»/«Municipio». **Memoria plurianual**: al elegir el preset
 * «Plurianual» en el selector de periodo, la serie pasa de
 * `group_by=month` a `group_by=year` (`SeriesChart` se etiqueta sola).
 */
export function ParaguasMetricsDashboard({ orgId, orgName }: ParaguasMetricsDashboardProps) {
  const t = useTranslations();
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [period, setPeriod] = useState<Period>(() => presetPeriod("mes"));
  const [compareGroupBy, setCompareGroupBy] = useState<ParaguasCompareGroupBy>("comarca");
  const compareSelectId = useId();

  function handlePeriodChange(next: Period, nextPreset: PeriodPreset) {
    setPeriod(next);
    setPreset(nextPreset);
  }

  const seriesGroupBy = preset === "plurianual" ? "year" : "month";
  const seriesHeading =
    preset === "plurianual"
      ? t("metrics.dashboard.yearlySeriesHeading")
      : t("metrics.dashboard.monthlySeriesHeading");
  const seriesEmptyTitle =
    preset === "plurianual"
      ? t("metrics.dashboard.yearlySeriesEmpty")
      : t("metrics.dashboard.monthlySeriesEmpty");

  const base = useMetrics("paraguas", orgId, period);
  const byMunicipio = useMetrics("paraguas", orgId, period, "place");
  const byEntidad = useMetrics("paraguas", orgId, period, "organization");
  const series = useMetrics("paraguas", orgId, period, seriesGroupBy);
  const compare = useCompare("paraguas", orgId, period, compareGroupBy);

  return (
    <div className="flex flex-col gap-6">
      <PeriodSelector value={period} preset={preset} onChange={handlePeriodChange} />

      {base.isError ? (
        <ErrorState
          title={t("metrics.dashboard.loadError")}
          description={errorKindText(base.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
        />
      ) : !base.data ? (
        <p className="text-sm text-text-secondary">
          {t("metrics.dashboard.loadingWithName", { orgName })}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label={t("metrics.stats.activePeople")}
              value={formatCount(base.data.people.active, base.data.people.suppressed)}
            />
            <StatCard
              label={t("metrics.stats.newPeople")}
              value={formatCount(base.data.people.new, base.data.people.suppressed)}
            />
            <StatCard
              label={t("metrics.stats.repeatingPeople")}
              value={formatCount(base.data.people.repeating, base.data.people.suppressed)}
            />
            <StatCard
              label={t("metrics.stats.eventsHeld")}
              value={formatCount(base.data.events.held, false)}
            />
            <StatCard
              label={t("metrics.stats.eventsCancelled")}
              value={formatCount(base.data.events.cancelled, false)}
            />
            <StatCard
              label={t("metrics.stats.attendanceRate")}
              value={formatPct(base.data.attendance.rate, base.data.attendance.suppressed)}
            />
            <StatCard
              label={t("metrics.stats.noShows")}
              value={formatCount(base.data.attendance.no_show, base.data.attendance.suppressed)}
            />
          </div>

          <section aria-labelledby="por-municipio-heading">
            <h2 id="por-municipio-heading" className="mb-2 text-lg font-semibold text-text-base">
              {t("metrics.dashboard.byMunicipioHeading")}
            </h2>
            {byMunicipio.isError ? (
              <ErrorState
                title={t("metrics.dashboard.byMunicipioError")}
                description={errorKindText(byMunicipio.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
              />
            ) : byMunicipio.data && byMunicipio.data.by_place.length > 0 ? (
              <MetricsTable
                caption={t("metrics.dashboard.byMunicipioCaption")}
                rows={byMunicipio.data.by_place}
                nameHeader={t("metrics.groupBy.place")}
                codeHeader={t("metrics.groupBy.ineCode")}
              />
            ) : (
              <EmptyState title={t("metrics.dashboard.byMunicipioEmpty")} />
            )}
          </section>

          <section aria-labelledby="por-entidad-heading">
            <h2 id="por-entidad-heading" className="mb-2 text-lg font-semibold text-text-base">
              {t("metrics.dashboard.byEntidadHeading")}
            </h2>
            {byEntidad.isError ? (
              <ErrorState
                title={t("metrics.dashboard.byEntidadError")}
                description={errorKindText(byEntidad.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
              />
            ) : byEntidad.data && byEntidad.data.by_place.length > 0 ? (
              <MetricsTable
                caption={t("metrics.dashboard.byEntidadCaption")}
                rows={byEntidad.data.by_place}
                nameHeader={t("metrics.groupBy.organization")}
              />
            ) : (
              <EmptyState title={t("metrics.dashboard.byEntidadEmpty")} />
            )}
          </section>

          <section aria-labelledby="serie-mensual-heading">
            <h2 id="serie-mensual-heading" className="mb-2 text-lg font-semibold text-text-base">
              {seriesHeading}
            </h2>
            {series.isError ? (
              <ErrorState
                title={t("metrics.dashboard.seriesError")}
                description={errorKindText(series.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
              />
            ) : series.data && series.data.series.length > 0 ? (
              <SeriesChart data={series.data.series} />
            ) : (
              <EmptyState title={seriesEmptyTitle} />
            )}
          </section>

          <section aria-labelledby="comparativa-heading">
            <h2 id="comparativa-heading" className="mb-2 text-lg font-semibold text-text-base">
              {t("metrics.dashboard.comparativaHeading")}
            </h2>
            <div className="mb-3">
              <label
                htmlFor={compareSelectId}
                className="mb-1 block text-sm font-medium text-text-form"
              >
                {t("metrics.dashboard.comparativaGroupByLabel")}
              </label>
              <select
                id={compareSelectId}
                value={compareGroupBy}
                onChange={(event) =>
                  setCompareGroupBy(event.target.value as ParaguasCompareGroupBy)
                }
                className="rounded-md border border-border px-2 py-1 text-sm text-text-base focus-visible:outline-primary-700"
              >
                {COMPARE_GROUP_BY_OPTION_KEYS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            {compare.isError ? (
              <ErrorState
                title={t("metrics.dashboard.comparativaError")}
                description={errorKindText(compare.error, COMPARE_ERROR_KEYS, t, "errors.compare.desconocido")}
              />
            ) : compare.data && compare.data.rows.length > 0 ? (
              <ComparativaTable data={compare.data} />
            ) : (
              <EmptyState title={t("metrics.dashboard.comparativaEmpty")} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
