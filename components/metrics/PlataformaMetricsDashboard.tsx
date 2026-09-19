"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCompare, type CompareErrorKind, type CompareGroupBy } from "@/hooks/useCompare";
import { useMetrics, type MetricsErrorKind, type MetricsGroupBy } from "@/hooks/useMetrics";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

import { ComparativaTable } from "./ComparativaTable";
import { ExportPanel } from "./ExportPanel";
import { MetricsTable } from "./MetricsTable";
import { PeriodSelector } from "./PeriodSelector";
import { SeriesChart } from "./SeriesChart";
import { StatCard } from "./StatCard";

type TableGroupBy = Extract<MetricsGroupBy, "place" | "organization">;

const GROUP_BY_OPTION_KEYS: { value: TableGroupBy; labelKey: string }[] = [
  { value: "place", labelKey: "plataforma.metricas.groupByTerritorio" },
  { value: "organization", labelKey: "metrics.groupBy.organization" },
];

type PlataformaCompareGroupBy = Extract<CompareGroupBy, "comarca" | "province" | "organization">;

const COMPARE_GROUP_BY_OPTION_KEYS: { value: PlataformaCompareGroupBy; labelKey: string }[] = [
  { value: "province", labelKey: "metrics.groupBy.province" },
  { value: "comarca", labelKey: "metrics.groupBy.comarca" },
  { value: "organization", labelKey: "metrics.groupBy.organization" },
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
  const t = useTranslations();
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
  const seriesHeading =
    preset === "plurianual"
      ? t("metrics.dashboard.yearlySeriesHeading")
      : t("metrics.dashboard.monthlySeriesHeading");
  const seriesEmptyTitle =
    preset === "plurianual"
      ? t("metrics.dashboard.yearlySeriesEmpty")
      : t("metrics.dashboard.monthlySeriesEmpty");

  const base = useMetrics("plataforma", undefined, period);
  const grouped = useMetrics("plataforma", undefined, period, groupBy);
  const series = useMetrics("plataforma", undefined, period, seriesGroupBy);
  const compare = useCompare("plataforma", undefined, period, compareGroupBy);

  return (
    <div className="flex flex-col gap-6">
      <PeriodSelector value={period} preset={preset} onChange={handlePeriodChange} />

      {base.isError ? (
        <ErrorState
          title={t("metrics.dashboard.loadError")}
          description={errorKindText(base.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
        />
      ) : !base.data ? (
        <p className="text-sm text-text-secondary">{t("metrics.dashboard.loading")}</p>
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

          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="text-sm font-medium text-text-form">
              {t("plataforma.metricas.groupByLegend")}
            </legend>
            {GROUP_BY_OPTION_KEYS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={groupBy === option.value ? "primary" : "secondary"}
                aria-pressed={groupBy === option.value}
                onClick={() => setGroupBy(option.value)}
              >
                {t(option.labelKey)}
              </Button>
            ))}
          </fieldset>

          <section aria-labelledby="metrics-table-heading">
            <h2 id="metrics-table-heading" className="mb-2 text-lg font-semibold text-text-base">
              {groupBy === "place"
                ? t("metrics.dashboard.byMunicipioHeading")
                : t("metrics.dashboard.byEntidadHeading")}
            </h2>
            {grouped.isError ? (
              <ErrorState
                title={t("metrics.dashboard.groupedError")}
                description={errorKindText(grouped.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
              />
            ) : grouped.data && grouped.data.by_place.length > 0 ? (
              <MetricsTable
                caption={
                  groupBy === "place"
                    ? t("metrics.dashboard.byMunicipioCaption")
                    : t("metrics.dashboard.byEntidadCaption")
                }
                rows={grouped.data.by_place}
                nameHeader={groupBy === "place" ? t("metrics.groupBy.place") : t("metrics.groupBy.organization")}
                codeHeader={groupBy === "place" ? t("metrics.groupBy.ineCode") : undefined}
              />
            ) : (
              <EmptyState title={t("metrics.dashboard.genericEmpty")} />
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
                  setCompareGroupBy(event.target.value as PlataformaCompareGroupBy)
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
