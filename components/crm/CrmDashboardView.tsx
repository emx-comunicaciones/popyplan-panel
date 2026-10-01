"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCrmDashboard } from "@/hooks/useCrm";
import { formatDate, formatMoney } from "@/lib/crm/format";
import { CRM_BASE } from "@/lib/crm/nav";

import { FilterBar, PeriodControls } from "./insights/Controls";
import { FunnelTable } from "./insights/FunnelTable";
import { KpiCard } from "./insights/KpiCard";
import { EMPTY_FILTERS, filterParams, periodParams, useInsightPeriod, type FilterValues } from "./insights/filters";
import { useInsightFormat } from "./insights/useInsightFormat";

export interface CrmDashboardViewProps {
  isManager: boolean;
  userId: number;
}

const linkClass =
  "inline-flex min-h-8 items-center rounded-md border border-border bg-white px-3 py-1 text-sm font-medium text-primary-700 underline hover:bg-border-light";

/** Dashboard comercial (`/plataforma/comercial`): KPIs del periodo, economía y embudo. */
export function CrmDashboardView({ isManager }: CrmDashboardViewProps) {
  const t = useTranslations("crm.dashboard");
  const tc = useTranslations("crm.common");
  const tp = useTranslations("pages.plataforma.comercial");
  const { int } = useInsightFormat();
  const period = useInsightPeriod();
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const dashboard = useCrmDashboard({ ...periodParams(period.applied), ...filterParams(filters) });
  const data = dashboard.data;

  const cards = data
    ? [
        { id: "accounts", label: t("kpi.accounts"), value: int(data.totals.accounts) },
        { id: "newAccounts", label: t("kpi.newAccounts"), value: int(data.current.new_accounts), change: data.change.new_accounts },
        { id: "contacted", label: t("kpi.contacted"), value: int(data.current.contacted_accounts), change: data.change.contacted_accounts },
        { id: "neverContacted", label: t("kpi.neverContacted"), value: int(data.totals.never_contacted) },
        { id: "contacts", label: t("kpi.contacts"), value: int(data.current.contacts), change: data.change.contacts },
        { id: "visits", label: t("kpi.visits"), value: int(data.current.visits), change: data.change.visits },
        { id: "meetings", label: t("kpi.meetings"), value: int(data.current.meetings), change: data.change.meetings },
        { id: "videoCalls", label: t("kpi.videoCalls"), value: int(data.current.video_calls), change: data.change.video_calls },
        { id: "calls", label: t("kpi.calls"), value: int(data.current.calls), change: data.change.calls },
        { id: "demos", label: t("kpi.demos"), value: int(data.current.demos), change: data.change.demos },
        { id: "proposalsSent", label: t("kpi.proposalsSent"), value: int(data.current.proposals_sent), change: data.change.proposals_sent },
        { id: "pilots", label: t("kpi.pilots"), value: int(data.current.pilots), change: data.change.pilots },
        { id: "openOpportunities", label: t("kpi.openOpportunities"), value: int(data.totals.open_opportunities) },
        { id: "won", label: t("kpi.won"), value: int(data.current.won), change: data.change.won },
        { id: "lost", label: t("kpi.lost"), value: int(data.current.lost), change: data.change.lost },
        { id: "pendingTasks", label: t("kpi.pendingTasks"), value: int(data.totals.pending_tasks) },
        { id: "overdueTasks", label: t("kpi.overdueTasks"), value: int(data.totals.overdue_tasks) },
        { id: "withoutFollowUp", label: t("kpi.withoutFollowUp"), value: int(data.totals.without_follow_up) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{tp("title")}</h1>
      <PeriodControls value={period.draft} onChange={period.update} invalid={period.invalid} />
      <FilterBar
        values={filters}
        onChange={setFilters}
        isManager={isManager}
        fields={["owner", "region", "province", "kind", "product", "stage"]}
      />

      {dashboard.isLoading ? <p className="text-sm text-text-secondary">{tc("loading")}</p> : null}
      {dashboard.isError ? <ErrorState title={t("error")} /> : null}

      {data ? (
        <>
          <p className="text-sm text-text-secondary">
            {t("range", {
              since: formatDate(data.period.since),
              until: formatDate(data.period.until),
              previousSince: formatDate(data.period.previous_since),
              previousUntil: formatDate(data.period.previous_until),
            })}
          </p>

          <div className="flex flex-wrap gap-2">
            <Link href={`${CRM_BASE}/atencion`} className={linkClass}>
              {t("attentionLink", { count: data.totals.without_follow_up })}
            </Link>
            <Link href={`${CRM_BASE}/tareas`} className={linkClass}>
              {t("overdueLink", { count: data.totals.overdue_tasks })}
            </Link>
          </div>

          <section aria-labelledby="crm-dashboard-activity" className="flex flex-col gap-2">
            <h2 id="crm-dashboard-activity" className="text-lg font-semibold text-text-base">
              {t("activityHeading")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {cards.map((card) => (
                <KpiCard key={card.id} label={card.label} value={card.value} change={card.change} />
              ))}
            </div>
          </section>

          <section aria-labelledby="crm-dashboard-money" className="flex flex-col gap-2">
            <h2 id="crm-dashboard-money" className="text-lg font-semibold text-text-base">
              {t("moneyHeading")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard label={t("money.pipelineValue")} value={formatMoney(data.money.pipeline_value)} />
              <KpiCard label={t("money.weightedPipeline")} value={formatMoney(data.money.weighted_pipeline)} />
              <KpiCard label={t("money.proposalsAmount")} value={formatMoney(data.money.proposals_amount)} />
              <KpiCard label={t("money.wonAmount")} value={formatMoney(data.money.won_amount)} />
              <KpiCard label={t("money.averageTicket")} value={formatMoney(data.money.average_ticket)} />
            </div>
            <p className="text-xs text-text-secondary">{t("money.note")}</p>
          </section>

          <section aria-labelledby="crm-dashboard-funnel" className="flex flex-col gap-2">
            <h2 id="crm-dashboard-funnel" className="text-lg font-semibold text-text-base">
              {t("funnelHeading")}
            </h2>
            <Card>
              <FunnelTable rows={data.funnel} />
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
