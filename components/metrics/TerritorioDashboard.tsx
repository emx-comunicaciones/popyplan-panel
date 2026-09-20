"use client";

/**
 * Observatorio del territorio declarado de una administración (spec de
 * diseño `2026-09-19-territorio-administraciones-design.md` §4.1, fila
 * «Territorio»). Ámbito `scope_territorio`: todo lo que ocurre en los
 * municipios del `OrgScope`, sea de la entidad que sea — a diferencia de
 * «Red financiada» (`ParaguasMetricsDashboard`), que va sobre el árbol
 * `parent`/`children`. Por eso aquí **no** hay desglose «Por entidad»:
 * la spec §3.1 lo excluye a propósito del contrato.
 *
 * Tres peticiones de métricas por periodo (el esquema fijo solo rellena
 * un desglose por petición, igual que en paraguas): base para las
 * tarjetas, `place` para el mapa y la tabla, y `month`/`year` para la
 * serie; más la comparativa y las coordenadas de los municipios que
 * salen en `by_place`.
 *
 * **409, «sin territorio declarado»** (§3.1): no es un error de carga
 * sino una configuración que falta — la pinta un `EmptyState` que ocupa
 * toda la pantalla (nunca tarjetas a cero, que se leerían como «no pasa
 * nada en mi territorio») y dice quién puede arreglarlo, porque la
 * administración no se declara su propio territorio (§2.3).
 *
 * **El mapa nunca es la única puerta a una ficha de municipio**: la
 * tabla «Por municipio» lleva un botón «Ver ficha» por fila que abre
 * exactamente el mismo panel lateral (el mapa es `role="img"`, sin nada
 * enfocable dentro). Por eso la tabla se pinta aunque las coordenadas
 * fallen: `usePlacesByIne` solo alimenta al mapa.
 */
import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCompare, type CompareErrorKind, type CompareGroupBy } from "@/hooks/useCompare";
import { useMetrics, type MetricsErrorKind } from "@/hooks/useMetrics";
import { usePlacesByIne, type PlacesErrorKind } from "@/hooks/usePlaces";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { toBubbles } from "@/lib/metrics/mapScale";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

import { ComparativaTable } from "./ComparativaTable";
import { MetricsTable } from "./MetricsTable";
import { PeriodSelector } from "./PeriodSelector";
import { PlaceSheetPanel } from "./PlaceSheetPanel";
import { SeriesChart } from "./SeriesChart";
import { StatCard } from "./StatCard";
import { TerritoryMap } from "./TerritoryMap";

export interface TerritorioDashboardProps {
  orgId: number | string;
}

/** Los tres desgloses que admite `compare/` en territorio (spec §3.1). */
type TerritorioCompareGroupBy = Extract<CompareGroupBy, "place" | "comarca" | "province">;

const COMPARE_GROUP_BY_OPTION_KEYS: { value: TerritorioCompareGroupBy; labelKey: string }[] = [
  { value: "comarca", labelKey: "metrics.groupBy.comarca" },
  { value: "place", labelKey: "metrics.groupBy.place" },
  { value: "province", labelKey: "metrics.groupBy.province" },
];

const METRICS_ERROR_KEYS: Record<MetricsErrorKind, string> = {
  periodo_invalido: "errors.metrics.periodoInvalido",
  sin_acceso: "errors.metrics.sinAcceso",
  sin_territorio: "errors.metrics.sinTerritorio",
  desconocido: "errors.metrics.desconocido",
};

const COMPARE_ERROR_KEYS: Record<CompareErrorKind, string> = {
  periodo_invalido: "errors.compare.periodoInvalido",
  sin_acceso: "errors.compare.sinAcceso",
  sin_territorio: "errors.compare.sinTerritorio",
  desconocido: "errors.compare.desconocido",
};

const PLACES_ERROR_KEYS: Record<PlacesErrorKind, string> = {
  demasiadas_paginas: "errors.places.demasiadasPaginas",
  desconocido: "errors.places.desconocido",
};

export function TerritorioDashboard({ orgId }: TerritorioDashboardProps) {
  const t = useTranslations();
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [period, setPeriod] = useState<Period>(() => presetPeriod("mes"));
  const [compareGroupBy, setCompareGroupBy] = useState<TerritorioCompareGroupBy>("comarca");
  const [selectedIne, setSelectedIne] = useState<string | null>(null);
  const compareSelectId = useId();

  function handlePeriodChange(next: Period, nextPreset: PeriodPreset) {
    setPeriod(next);
    setPreset(nextPreset);
    // La ficha abierta es del periodo anterior: cerrarla evita enseñar
    // cifras de un rango que ya no es el que se está mirando.
    setSelectedIne(null);
  }

  const seriesGroupBy = preset === "plurianual" ? "year" : "month";

  const base = useMetrics("territorio", orgId, period);
  const byMunicipio = useMetrics("territorio", orgId, period, "place");
  const series = useMetrics("territorio", orgId, period, seriesGroupBy);
  const compare = useCompare("territorio", orgId, period, compareGroupBy);

  const placeRows = useMemo(() => byMunicipio.data?.by_place ?? [], [byMunicipio.data]);
  const ineCodes = useMemo(() => placeRows.map((row) => row.key), [placeRows]);
  const places = usePlacesByIne(ineCodes);
  const bubbles = useMemo(() => toBubbles(placeRows, places.data ?? []), [placeRows, places.data]);

  // Cualquiera de las consultas de territorio responde el mismo 409; con
  // la base basta para decidir la pantalla entera.
  if (base.error?.kind === "sin_territorio") {
    return (
      <EmptyState
        title={errorKindText(base.error, METRICS_ERROR_KEYS, t, "errors.metrics.sinTerritorio")}
        description={t("paraguas.territorio.noTerritoryHint")}
      />
    );
  }

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
              label={t("metrics.stats.eventsHeld")}
              value={formatCount(base.data.events.held, false)}
            />
            <StatCard
              label={t("metrics.stats.attendanceRate")}
              value={formatPct(base.data.attendance.rate, base.data.attendance.suppressed)}
            />
            <StatCard
              label={t("paraguas.territorio.communitiesStat")}
              value={formatCount(base.data.communities.active, base.data.communities.suppressed)}
            />
          </div>

          <section aria-labelledby="territorio-mapa-heading">
            <h2 id="territorio-mapa-heading" className="mb-2 text-lg font-semibold text-text-base">
              {t("metrics.map.heading")}
            </h2>
            <p className="mb-2 text-sm text-text-secondary">{t("metrics.map.legend")}</p>
            {byMunicipio.isError ? (
              <ErrorState
                title={t("metrics.dashboard.byMunicipioError")}
                description={errorKindText(byMunicipio.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
              />
            ) : places.error?.kind === "demasiadas_paginas" ? (
              // No es un fallo de la pantalla: el mapa no se puede
              // dibujar con tantos municipios, pero la tabla de debajo
              // sigue completa y con su «Ver ficha» por fila. Por eso un
              // aviso propio que dice qué hacer (acotar el periodo), y no
              // el `ErrorState` genérico de «no se pudieron cargar».
              <EmptyState
                title={t("paraguas.territorio.tooManyPlaces")}
                description={t("paraguas.territorio.tooManyPlacesHint")}
              />
            ) : places.isError ? (
              <ErrorState
                title={t("paraguas.territorio.placesError")}
                description={errorKindText(places.error, PLACES_ERROR_KEYS, t, "errors.places.desconocido")}
              />
            ) : (
              <TerritoryMap bubbles={bubbles} onSelect={setSelectedIne} />
            )}
          </section>

          <section aria-labelledby="territorio-tabla-heading">
            <h2 id="territorio-tabla-heading" className="mb-2 text-lg font-semibold text-text-base">
              {t("metrics.dashboard.byMunicipioHeading")}
            </h2>
            {byMunicipio.isError ? (
              <ErrorState
                title={t("metrics.dashboard.byMunicipioError")}
                description={errorKindText(byMunicipio.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
              />
            ) : placeRows.length > 0 ? (
              <MetricsTable
                caption={t("metrics.dashboard.byMunicipioCaption")}
                rows={placeRows}
                nameHeader={t("metrics.groupBy.place")}
                codeHeader={t("metrics.groupBy.ineCode")}
                onSelectRow={setSelectedIne}
                selectRowLabel={t("paraguas.territorio.openSheet")}
                selectRowAriaLabel={(row) => t("paraguas.territorio.openSheetFor", { place: row.label })}
              />
            ) : (
              <EmptyState title={t("metrics.dashboard.byMunicipioEmpty")} />
            )}
          </section>

          <section aria-labelledby="territorio-serie-heading">
            <h2 id="territorio-serie-heading" className="mb-2 text-lg font-semibold text-text-base">
              {preset === "plurianual"
                ? t("metrics.dashboard.yearlySeriesHeading")
                : t("metrics.dashboard.monthlySeriesHeading")}
            </h2>
            {series.isError ? (
              <ErrorState
                title={t("metrics.dashboard.seriesError")}
                description={errorKindText(series.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
              />
            ) : series.data && series.data.series.length > 0 ? (
              <SeriesChart data={series.data.series} />
            ) : (
              <EmptyState
                title={
                  preset === "plurianual"
                    ? t("metrics.dashboard.yearlySeriesEmpty")
                    : t("metrics.dashboard.monthlySeriesEmpty")
                }
              />
            )}
          </section>

          <section aria-labelledby="territorio-comparativa-heading">
            <h2
              id="territorio-comparativa-heading"
              className="mb-2 text-lg font-semibold text-text-base"
            >
              {t("metrics.dashboard.comparativaHeading")}
            </h2>
            <div className="mb-3">
              <label htmlFor={compareSelectId} className="mb-1 block text-sm font-medium text-text-form">
                {t("metrics.dashboard.comparativaGroupByLabel")}
              </label>
              <select
                id={compareSelectId}
                value={compareGroupBy}
                onChange={(event) => setCompareGroupBy(event.target.value as TerritorioCompareGroupBy)}
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

      {selectedIne ? (
        <PlaceSheetPanel
          orgId={orgId}
          ineCode={selectedIne}
          period={period}
          onClose={() => setSelectedIne(null)}
        />
      ) : null}
    </div>
  );
}
