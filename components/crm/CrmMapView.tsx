"use client";

/**
 * Mapa comercial (`/plataforma/comercial/mapa`): entidades con coordenadas
 * como marcadores que se distinguen por forma y letra (no solo color),
 * leyenda, lista equivalente (accesibilidad y móvil) y cobertura
 * territorial. Leaflet solo se carga en el cliente (`next/dynamic`).
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table, type TableColumn } from "@/components/ui/Table";
import { useCrmCoverage, useCrmMap } from "@/hooks/useCrm";
import type { CrmCoverageRow, CrmMapPoint } from "@/lib/api/crmTypes";
import { formatDate, formatMoney } from "@/lib/crm/format";
import { crmAccountHref } from "@/lib/crm/nav";

import { crmInputClass, crmLabelClass } from "./common";
import { FilterBar } from "./insights/Controls";
import { EMPTY_FILTERS, filterParams, type FilterValues } from "./insights/filters";
import { MAP_STATUSES, MapGlyph, mapStatus, type MapStatus } from "./insights/mapStatus";
import { useInsightFormat } from "./insights/useInsightFormat";

export interface CrmMapViewProps {
  isManager: boolean;
  userId: number;
}

function MapLoadingFallback() {
  const t = useTranslations("metrics.map");
  return <p className="p-4 text-sm text-text-secondary">{t("loading")}</p>;
}

const CrmMapCanvas = dynamic(() => import("./insights/CrmMapCanvas").then((module) => module.CrmMapCanvas), {
  ssr: false,
  loading: MapLoadingFallback,
});

const PAGE = 100;

const STATUS_LABELS: Record<MapStatus, string> = {
  sin_contactar: "crm.map.status.sin_contactar",
  contactado: "crm.map.status.contactado",
  interesado: "crm.map.status.interesado",
  negociacion: "crm.map.status.negociacion",
  cliente: "crm.map.status.cliente",
  perdido: "crm.map.status.perdido",
};

type CoverageLevel = "province" | "region";

export function CrmMapView({ isManager }: CrmMapViewProps) {
  const t = useTranslations("crm.map");
  const tAll = useTranslations();
  const tc = useTranslations("crm.common");
  const tm = useTranslations("metrics.map");
  const { int, pct } = useInsightFormat();
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [minPopulation, setMinPopulation] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [level, setLevel] = useState<CoverageLevel>("province");

  const map = useCrmMap(filterParams(filters));
  const coverage = useCrmCoverage({ level });

  const minimum = Number(minPopulation) || 0;
  const points = useMemo(
    () =>
      (map.data ?? []).filter(
        (point) =>
          Number.isFinite(Number(point.latitude)) &&
          Number.isFinite(Number(point.longitude)) &&
          (minimum <= 0 || (point.population ?? 0) >= minimum),
      ),
    [map.data, minimum],
  );
  const counts = useMemo(() => {
    const out = Object.fromEntries(MAP_STATUSES.map((s) => [s, 0])) as Record<MapStatus, number>;
    for (const point of points) out[mapStatus(point)] += 1;
    return out;
  }, [points]);

  const statusText = (point: CrmMapPoint) => tAll(STATUS_LABELS[mapStatus(point)]);

  const renderPopup = (point: CrmMapPoint) => (
    <div className="flex flex-col gap-0.5 text-sm text-text-base">
      <p className="font-semibold">{point.name}</p>
      <p>{t("popup.municipality", { value: point.municipality || tc("none") })}</p>
      <p>{t("popup.population", { value: point.population === null ? tc("none") : int(point.population) })}</p>
      <p>{t("popup.stage", { value: point.stage_name || statusText(point) })}</p>
      <p>{t("popup.owner", { value: point.owner_name || tc("none") })}</p>
      <p>{t("popup.lastActivity", { value: formatDate(point.last_activity_at) })}</p>
      <p>{t("popup.nextActivity", { value: formatDate(point.next_activity_at) })}</p>
      <p>{t("popup.openValue", { value: formatMoney(point.open_value) })}</p>
      <Link href={crmAccountHref(point.id)} className="font-medium text-primary-700 underline">
        {t("popup.viewAccount")}
      </Link>
    </div>
  );

  const listColumns: TableColumn<CrmMapPoint>[] = [
    {
      key: "name",
      header: t("list.name"),
      render: (point) => (
        <Link href={crmAccountHref(point.id)} className="font-medium text-primary-700 underline">
          {point.name}
        </Link>
      ),
    },
    { key: "municipality", header: t("list.municipality"), render: (point) => point.municipality || tc("none") },
    { key: "province", header: t("list.province"), render: (point) => point.province || tc("none") },
    {
      key: "status",
      header: t("list.status"),
      render: (point) => (
        <span className="inline-flex items-center gap-1.5">
          <MapGlyph status={mapStatus(point)} size={16} />
          {statusText(point)}
        </span>
      ),
    },
    { key: "stage", header: t("list.stage"), render: (point) => point.stage_name || tc("none") },
    { key: "owner", header: t("list.owner"), render: (point) => point.owner_name || tc("none") },
    { key: "population", header: t("list.population"), render: (point) => int(point.population) },
    { key: "last", header: t("list.lastActivity"), render: (point) => formatDate(point.last_activity_at) },
    { key: "value", header: t("list.openValue"), render: (point) => formatMoney(point.open_value) },
  ];

  const coverageRows = coverage.data ?? [];
  const totals = coverageRows.reduce(
    (acc, row) => ({
      registered: acc.registered + row.registered,
      contacted: acc.contacted + row.contacted,
      negotiating: acc.negotiating + row.negotiating,
      clients: acc.clients + row.clients,
    }),
    { registered: 0, contacted: 0, negotiating: 0, clients: 0 },
  );
  const totalCoverage = totals.registered > 0 ? (totals.contacted * 100) / totals.registered : 0;
  const levelLabels: Record<CoverageLevel, string> = { province: t("coverage.province"), region: t("coverage.region") };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{tAll("pages.plataforma.comercialMapa.title")}</h1>
      <FilterBar
        values={filters}
        onChange={(next) => {
          setFilters(next);
          setVisible(PAGE);
        }}
        isManager={isManager}
        fields={["owner", "region", "province", "stage", "product", "interest"]}
        extra={
          <div>
            <label htmlFor="crm-map-min-population" className={crmLabelClass}>
              {t("filters.minPopulation")}
            </label>
            <input
              id="crm-map-min-population"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={minPopulation}
              onChange={(event) => {
                setMinPopulation(event.target.value);
                setVisible(PAGE);
              }}
              className={crmInputClass}
            />
          </div>
        }
      />

      {map.isLoading ? <p className="text-sm text-text-secondary">{tc("loading")}</p> : null}
      {map.isError ? <ErrorState title={t("error")} /> : null}

      {map.data ? (
        <>
          <section aria-labelledby="crm-map-legend" className="rounded-lg border border-border bg-white p-3">
            <h2 id="crm-map-legend" className="mb-1 text-sm font-semibold text-text-secondary">
              {t("legend.heading")}
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {MAP_STATUSES.map((status) => (
                <li key={status} className="inline-flex items-center gap-1.5 text-sm text-text-base">
                  <MapGlyph status={status} />
                  <span>{t("legend.item", { status: tAll(STATUS_LABELS[status]), count: counts[status] })}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-text-secondary">{t("legend.note")}</p>
          </section>

          {points.length === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            <div>
              <div
                role="region"
                aria-label={t("mapLabel", { count: points.length })}
                className="h-[28rem] w-full overflow-hidden rounded-lg border border-border"
              >
                <CrmMapCanvas points={points} renderPopup={renderPopup} />
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                {tm.rich("attribution", {
                  osm: (chunks) => (
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-medium text-primary-700 underline"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </div>
          )}

          <section aria-labelledby="crm-map-list" className="flex flex-col gap-2">
            <h2 id="crm-map-list" className="text-lg font-semibold text-text-base">
              {t("list.heading")}
            </h2>
            <div>
              <Button
                type="button"
                variant="secondary"
                aria-expanded={listOpen}
                aria-controls="crm-map-list-panel"
                onClick={() => setListOpen((open) => !open)}
              >
                {listOpen ? t("list.hide") : t("list.show", { count: points.length })}
              </Button>
            </div>
            {listOpen ? (
              <div id="crm-map-list-panel" className="flex flex-col gap-2">
                <Card>
                  <Table
                    caption={t("list.caption")}
                    columns={listColumns}
                    rows={points.slice(0, visible)}
                    getRowKey={(point) => String(point.id)}
                  />
                </Card>
                {visible < points.length ? (
                  <div>
                    <Button type="button" variant="secondary" onClick={() => setVisible((n) => n + PAGE)}>
                      {t("list.showMore", { shown: Math.min(visible, points.length), total: points.length })}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      <section aria-labelledby="crm-map-coverage" className="flex flex-col gap-2">
        <h2 id="crm-map-coverage" className="text-lg font-semibold text-text-base">
          {t("coverage.heading")}
        </h2>
        <p className="text-sm text-text-secondary">{t("coverage.note")}</p>
        <div role="group" aria-label={t("coverage.levelGroup")} className="flex gap-1.5">
          {(["province", "region"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={level === option}
              onClick={() => setLevel(option)}
              className={`min-h-8 rounded-md border px-3 py-1 text-sm font-medium ${
                level === option
                  ? "border-primary-700 bg-primary-700 text-text-inverse"
                  : "border-border bg-white text-text-form hover:bg-border-light"
              }`}
            >
              {levelLabels[option]}
            </button>
          ))}
        </div>
        {coverage.isLoading ? <p className="text-sm text-text-secondary">{tc("loading")}</p> : null}
        {coverage.isError ? <ErrorState title={t("coverage.error")} /> : null}
        {coverage.data ? (
          coverageRows.length === 0 ? (
            <EmptyState title={t("coverage.empty")} />
          ) : (
            <Card>
              <CoverageTable
                caption={t("coverage.caption", { level: levelLabels[level] })}
                nameHeader={levelLabels[level]}
                rows={coverageRows}
                totals={{ ...totals, coverage: totalCoverage }}
                pct={pct}
                int={int}
              />
            </Card>
          )
        ) : null}
      </section>
    </div>
  );
}

function CoverageTable({
  caption,
  nameHeader,
  rows,
  totals,
  pct,
  int,
}: {
  caption: string;
  nameHeader: string;
  rows: CrmCoverageRow[];
  totals: Omit<CrmCoverageRow, "name">;
  pct: (value: number) => string;
  int: (value: number) => string;
}) {
  const t = useTranslations("crm.map.coverage");
  const head = "px-3 py-1.5 font-semibold";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-text-secondary">
            <th scope="col" className={head}>{nameHeader}</th>
            <th scope="col" className={head}>{t("registered")}</th>
            <th scope="col" className={head}>{t("contacted")}</th>
            <th scope="col" className={head}>{t("negotiating")}</th>
            <th scope="col" className={head}>{t("clients")}</th>
            <th scope="col" className={head}>{t("coverage")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-border-light">
              <th scope="row" className="px-3 py-1.5 font-medium text-text-base">{row.name}</th>
              <td className="px-3 py-1.5 text-text-base">{int(row.registered)}</td>
              <td className="px-3 py-1.5 text-text-base">{int(row.contacted)}</td>
              <td className="px-3 py-1.5 text-text-base">{int(row.negotiating)}</td>
              <td className="px-3 py-1.5 text-text-base">{int(row.clients)}</td>
              <td className="px-3 py-1.5 text-text-base">{pct(row.coverage)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-semibold">
            <th scope="row" className="px-3 py-1.5 text-text-base">{t("totals")}</th>
            <td className="px-3 py-1.5 text-text-base">{int(totals.registered)}</td>
            <td className="px-3 py-1.5 text-text-base">{int(totals.contacted)}</td>
            <td className="px-3 py-1.5 text-text-base">{int(totals.negotiating)}</td>
            <td className="px-3 py-1.5 text-text-base">{int(totals.clients)}</td>
            <td className="px-3 py-1.5 text-text-base">{pct(totals.coverage)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
