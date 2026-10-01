"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table, type TableColumn } from "@/components/ui/Table";
import { downloadCrmExport, useCrmReport } from "@/hooks/useCrm";
import type { CrmExportResource, CrmSalespersonRow } from "@/lib/api/crmTypes";
import { formatDate, formatMoney } from "@/lib/crm/format";
import { CRM_ACTIVITY_KIND_LABELS, CRM_LOST_REASON_LABELS, crmLabel } from "@/lib/crm/labels";

import { FilterBar, PeriodControls } from "./insights/Controls";
import { FunnelTable } from "./insights/FunnelTable";
import { KpiCard } from "./insights/KpiCard";
import { EMPTY_FILTERS, filterParams, periodParams, useInsightPeriod, type FilterValues } from "./insights/filters";
import { useInsightFormat } from "./insights/useInsightFormat";

export interface CrmReportsViewProps {
  isManager: boolean;
  userId: number;
}

type ReportExport = Extract<CrmExportResource, "accounts" | "opportunities" | "activities">;
const EXPORTS: ReportExport[] = ["accounts", "opportunities", "activities"];

/** Informes (`/plataforma/comercial/informes`): actividad, embudo, comerciales y pérdidas. */
export function CrmReportsView({ isManager }: CrmReportsViewProps) {
  const t = useTranslations("crm.reports");
  const tAll = useTranslations();
  const tc = useTranslations("crm.common");
  const { int, pct, decimal, none } = useInsightFormat();
  const period = useInsightPeriod();
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [exporting, setExporting] = useState<ReportExport | null>(null);
  const [exportError, setExportError] = useState(false);
  const report = useCrmReport({ ...periodParams(period.applied), ...filterParams(filters) });
  const data = report.data;

  const exportLabels: Record<ReportExport, string> = {
    accounts: t("export.accounts"),
    opportunities: t("export.opportunities"),
    activities: t("export.activities"),
  };

  async function runExport(resource: ReportExport) {
    setExporting(resource);
    setExportError(false);
    try {
      await downloadCrmExport(resource, filterParams(filters));
    } catch {
      setExportError(true);
    } finally {
      setExporting(null);
    }
  }

  // Alfabético y sin ordenar por ninguna cifra: no es un ranking.
  const salespeople = data
    ? [...data.by_salesperson].sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const num = (pick: (row: CrmSalespersonRow) => number) => (row: CrmSalespersonRow) => int(pick(row));
  const columns: TableColumn<CrmSalespersonRow>[] = [
    { key: "name", header: t("team.name"), render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "accounts", header: t("team.accounts"), render: num((r) => r.accounts) },
    { key: "contacts", header: t("team.contacts"), render: num((r) => r.contacts) },
    { key: "visits", header: t("team.visits"), render: num((r) => r.visits) },
    { key: "meetings", header: t("team.meetings"), render: num((r) => r.meetings) },
    { key: "videoCalls", header: t("team.videoCalls"), render: num((r) => r.video_calls) },
    { key: "calls", header: t("team.calls"), render: num((r) => r.calls) },
    { key: "demos", header: t("team.demos"), render: num((r) => r.demos) },
    { key: "proposals", header: t("team.proposals"), render: num((r) => r.proposals) },
    { key: "open", header: t("team.openOpportunities"), render: num((r) => r.open_opportunities) },
    { key: "pipeline", header: t("team.pipelineValue"), render: (r) => formatMoney(r.pipeline_value) },
    { key: "contracts", header: t("team.contracts"), render: num((r) => r.contracts) },
    { key: "won", header: t("team.wonAmount"), render: (r) => formatMoney(r.won_amount) },
    { key: "pending", header: t("team.pendingTasks"), render: num((r) => r.pending_tasks) },
    { key: "overdue", header: t("team.overdueTasks"), render: num((r) => r.overdue_tasks) },
    { key: "winRate", header: t("team.winRate"), render: (r) => pct(r.win_rate) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{tAll("pages.plataforma.comercialInformes.title")}</h1>
      <PeriodControls value={period.draft} onChange={period.update} invalid={period.invalid} />
      <FilterBar
        values={filters}
        onChange={setFilters}
        isManager={isManager}
        fields={["owner", "region", "province", "kind", "product", "stage", "interest"]}
      />

      <section aria-labelledby="crm-reports-export" className="flex flex-col gap-2">
        <h2 id="crm-reports-export" className="text-lg font-semibold text-text-base">
          {t("export.heading")}
        </h2>
        <p className="text-sm text-text-secondary">{t("export.note")}</p>
        <div className="flex flex-wrap gap-2">
          {EXPORTS.map((resource) => (
            <Button
              key={resource}
              type="button"
              variant="secondary"
              disabled={exporting !== null}
              onClick={() => void runExport(resource)}
            >
              {exporting === resource ? t("export.exporting") : exportLabels[resource]}
            </Button>
          ))}
        </div>
        {exportError ? (
          <p role="alert" className="text-sm text-error">
            {t("export.error")}
          </p>
        ) : null}
      </section>

      {report.isLoading ? <p className="text-sm text-text-secondary">{tc("loading")}</p> : null}
      {report.isError ? <ErrorState title={t("error")} /> : null}

      {data ? (
        <>
          <p className="text-sm text-text-secondary">
            {t("range", { since: formatDate(data.period.since), until: formatDate(data.period.until) })}
          </p>

          <section aria-labelledby="crm-reports-activity" className="flex flex-col gap-2">
            <h2 id="crm-reports-activity" className="text-lg font-semibold text-text-base">
              {t("activity.heading")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <KpiCard label={t("activity.contacts")} value={int(data.activity.contacts)} />
              <KpiCard label={t("activity.visits")} value={int(data.activity.visits)} />
              <KpiCard label={t("activity.meetings")} value={int(data.activity.meetings)} />
              <KpiCard label={t("activity.videoCalls")} value={int(data.activity.video_calls)} />
              <KpiCard label={t("activity.calls")} value={int(data.activity.calls)} />
              <KpiCard label={t("activity.demos")} value={int(data.activity.demos)} />
              <KpiCard label={t("activity.pilots")} value={int(data.activity.pilots)} />
              <KpiCard
                label={t("activity.averageDays")}
                value={data.average_days_between_contacts === null ? none : decimal(data.average_days_between_contacts)}
              />
              <KpiCard label={t("activity.withoutFollowUp")} value={int(data.without_follow_up)} />
              <KpiCard label={t("activity.wonAmount")} value={formatMoney(data.won_amount)} />
            </div>
            {Object.keys(data.activity.by_kind).length > 0 ? (
              <Card>
                <Table
                  caption={t("activity.byKindCaption")}
                  getRowKey={(row) => row.kind}
                  rows={Object.entries(data.activity.by_kind).map(([kind, count]) => ({ kind, count }))}
                  columns={[
                    {
                      key: "kind",
                      header: t("activity.kind"),
                      render: (row) => crmLabel(CRM_ACTIVITY_KIND_LABELS, row.kind, tAll),
                    },
                    { key: "count", header: t("activity.count"), render: (row) => int(row.count) },
                  ]}
                />
              </Card>
            ) : null}
          </section>

          <section aria-labelledby="crm-reports-funnel" className="flex flex-col gap-2">
            <h2 id="crm-reports-funnel" className="text-lg font-semibold text-text-base">
              {t("funnelHeading")}
            </h2>
            <Card>
              <FunnelTable rows={data.funnel} withBars={false} withReached />
            </Card>
          </section>

          <section aria-labelledby="crm-reports-team" className="flex flex-col gap-2">
            <h2 id="crm-reports-team" className="text-lg font-semibold text-text-base">
              {t("team.heading")}
            </h2>
            <p className="text-sm text-text-secondary">{t("team.note")}</p>
            <Card>
              <Table
                caption={t("team.caption")}
                columns={columns}
                rows={salespeople}
                getRowKey={(row) => String(row.user)}
              />
            </Card>
          </section>

          <section aria-labelledby="crm-reports-lost" className="flex flex-col gap-2">
            <h2 id="crm-reports-lost" className="text-lg font-semibold text-text-base">
              {t("lost.heading")}
            </h2>
            {data.lost_reasons.length === 0 ? (
              <p className="text-sm text-text-secondary">{t("lost.empty")}</p>
            ) : (
              <Card>
                <Table
                  caption={t("lost.caption")}
                  getRowKey={(row) => row.reason}
                  rows={data.lost_reasons}
                  columns={[
                    {
                      key: "reason",
                      header: t("lost.reason"),
                      render: (row) =>
                        CRM_LOST_REASON_LABELS[row.reason] ? tAll(CRM_LOST_REASON_LABELS[row.reason]) : row.label,
                    },
                    { key: "count", header: t("lost.count"), render: (row) => int(row.count) },
                  ]}
                />
              </Card>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
