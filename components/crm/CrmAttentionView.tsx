"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table, type TableColumn } from "@/components/ui/Table";
import { useCrmAttention } from "@/hooks/useCrm";
import type { CrmAttentionRow } from "@/lib/api/crmTypes";
import { formatDate, formatMoney } from "@/lib/crm/format";
import { crmAccountHref } from "@/lib/crm/nav";

import { StageBadge } from "./common";
import { useCrmContext } from "./CrmShell";
import { FilterBar } from "./insights/Controls";
import { EMPTY_FILTERS, type FilterValues } from "./insights/filters";

export interface CrmAttentionViewProps {
  isManager: boolean;
  userId: number;
}

/** «Necesitan atención»: entidades sin contacto reciente, de más a menos urgente. */
export function CrmAttentionView({ isManager }: CrmAttentionViewProps) {
  const t = useTranslations("crm.attention");
  const tAll = useTranslations();
  const tc = useTranslations("crm.common");
  const format = useFormatter();
  const { openActivity } = useCrmContext();
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const attention = useCrmAttention({
    owner: filters.owner,
    province: filters.province,
    page: page > 1 ? page : undefined,
  });
  const data = attention.data;
  const thresholds = data?.thresholds ?? [];
  const highest = thresholds.length ? Math.max(...thresholds) : null;

  const columns: TableColumn<CrmAttentionRow>[] = [
    {
      key: "account",
      header: t("columns.account"),
      render: (row) => (
        <Link href={crmAccountHref(row.id)} className="font-medium text-primary-700 underline">
          {row.name}
        </Link>
      ),
    },
    { key: "owner", header: t("columns.owner"), render: (row) => row.owner?.name ?? tc("none") },
    { key: "stage", header: t("columns.stage"), render: (row) => <StageBadge stage={row.stage} /> },
    {
      key: "last",
      header: t("columns.lastActivity"),
      render: (row) => (row.last_activity_at ? formatDate(row.last_activity_at) : t("never")),
    },
    {
      key: "days",
      header: t("columns.days"),
      render: (row) =>
        row.days_without_contact === null ? t("never") : t("days", { count: row.days_without_contact }),
    },
    {
      key: "level",
      header: t("columns.level"),
      render: (row) =>
        row.attention_level === null ? (
          tc("none")
        ) : (
          <Badge tone={row.attention_level === highest ? "error" : "info"}>
            {t("level", { level: row.attention_level })}
          </Badge>
        ),
    },
    { key: "value", header: t("columns.potential"), render: (row) => formatMoney(row.open_value) },
    {
      key: "task",
      header: t("columns.nextTask"),
      render: (row) =>
        row.next_task
          ? t("nextTask", { title: row.next_task.title ?? "", date: formatDate(row.next_task.due_at) })
          : tc("none"),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      render: (row) => (
        <Button
          type="button"
          variant="secondary"
          aria-label={t("registerFor", { name: row.name })}
          onClick={() => openActivity({ account: { id: row.id, name: row.name } })}
        >
          {t("register")}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{tAll("pages.plataforma.comercialAtencion.title")}</h1>
      {thresholds.length > 0 ? (
        <p className="text-sm text-text-secondary">
          {t("intro", { levels: format.list(thresholds.map((value) => String(value)), { type: "conjunction" }) })}
        </p>
      ) : null}
      <FilterBar
        values={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        isManager={isManager}
        fields={["owner", "province"]}
      />
      {attention.isLoading ? <p className="text-sm text-text-secondary">{tc("loading")}</p> : null}
      {attention.isError ? <ErrorState title={t("error")} /> : null}
      {data ? (
        data.results.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <>
            <p className="text-sm text-text-secondary">{t("count", { count: data.count })}</p>
            <Card>
              <Table
                caption={t("caption")}
                columns={columns}
                rows={data.results}
                getRowKey={(row) => String(row.id)}
              />
            </Card>
            <nav aria-label={t("pagination.label")} className="flex items-center gap-2">
              <Button type="button" variant="secondary" disabled={!data.previous} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                {t("pagination.previous")}
              </Button>
              <span className="text-sm text-text-secondary">{t("pagination.page", { page })}</span>
              <Button type="button" variant="secondary" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
                {t("pagination.next")}
              </Button>
            </nav>
          </>
        )
      ) : null}
    </div>
  );
}
