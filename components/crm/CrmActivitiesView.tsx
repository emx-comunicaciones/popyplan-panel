"use client";

/**
 * Actividades (puntos 13 y 36-38): listado de todo lo registrado con
 * filtros, detalle/edición, borrado (lógico, con confirmación) y
 * exportación a CSV.
 */
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { downloadCrmExport, useCrmActivities, useDeleteActivity } from "@/hooks/useCrm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { CrmActivity } from "@/lib/api/crmTypes";
import { formatDateTime } from "@/lib/crm/format";
import {
  CRM_ACTIVITY_KINDS,
  CRM_ACTIVITY_KIND_LABELS,
  CRM_RESULT_LABELS,
  crmLabel,
} from "@/lib/crm/labels";
import { crmAccountHref } from "@/lib/crm/nav";

import { crmLabelClass } from "./common";
import { useCrmContext } from "./CrmShell";
import { ActivityDialog } from "./work/ActivityDialog";
import { CRM_PAGE_SIZE, CrmUserFilter, Pager, crmFilterInputClass, useCrmErrorText } from "./work/shared";

export interface CrmActivitiesViewProps {
  isManager: boolean;
  userId: number;
}

export function CrmActivitiesView({ isManager }: CrmActivitiesViewProps) {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const { openActivity } = useCrmContext();
  const [kind, setKind] = useState("");
  const [owner, setOwner] = useState<number | "">("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CrmActivity | null>(null);
  const [deleting, setDeleting] = useState<CrmActivity | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const debouncedQ = useDebouncedValue(q, 300).trim();

  const filters = {
    activity_kind: kind,
    activity_owner: isManager ? owner : "",
    since,
    until,
    q: debouncedQ,
  };
  const activities = useCrmActivities({ ...filters, page, page_size: CRM_PAGE_SIZE });
  const remove = useDeleteActivity();

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  async function exportCsv() {
    setExportError(null);
    try {
      await downloadCrmExport("activities", filters);
    } catch (error) {
      setExportError(errorText(error as never));
    }
  }

  const rows = activities.data?.results ?? [];
  const count = activities.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / CRM_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text-base">{t("pages.plataforma.comercialActividades.title")}</h1>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={exportCsv}>
            {t("crm.activities.export")}
          </Button>
          <Button type="button" onClick={() => openActivity()}>
            {t("crm.activities.register")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-border-light p-2">
        <div>
          <label htmlFor="crm-act-f-kind" className={crmLabelClass}>
            {t("crm.activities.filters.kind")}
          </label>
          <select
            id="crm-act-f-kind"
            value={kind}
            onChange={(e) => change(setKind)(e.target.value)}
            className={crmFilterInputClass}
          >
            <option value="">{t("crm.activities.filters.allKinds")}</option>
            {CRM_ACTIVITY_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(CRM_ACTIVITY_KIND_LABELS[k])}
              </option>
            ))}
          </select>
        </div>
        {isManager ? (
          <CrmUserFilter
            id="crm-act-f-owner"
            label={t("crm.activities.filters.owner")}
            allLabel={t("crm.activities.filters.allOwners")}
            value={owner}
            onChange={change(setOwner)}
          />
        ) : null}
        <div>
          <label htmlFor="crm-act-f-since" className={crmLabelClass}>
            {t("crm.activities.filters.since")}
          </label>
          <input
            id="crm-act-f-since"
            type="date"
            value={since}
            onChange={(e) => change(setSince)(e.target.value)}
            className={crmFilterInputClass}
          />
        </div>
        <div>
          <label htmlFor="crm-act-f-until" className={crmLabelClass}>
            {t("crm.activities.filters.until")}
          </label>
          <input
            id="crm-act-f-until"
            type="date"
            value={until}
            onChange={(e) => change(setUntil)(e.target.value)}
            className={crmFilterInputClass}
          />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="crm-act-f-q" className={crmLabelClass}>
            {t("crm.activities.filters.search")}
          </label>
          <input
            id="crm-act-f-q"
            type="search"
            value={q}
            onChange={(e) => change(setQ)(e.target.value)}
            className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {exportError ? (
        <p role="alert" className="text-sm text-error">
          {exportError}
        </p>
      ) : null}

      {activities.isLoading ? (
        <p role="status" className="text-sm text-text-secondary">
          {t("crm.common.loading")}
        </p>
      ) : activities.isError ? (
        <ErrorState title={t("crm.activities.loadError")} description={errorText(activities.error)} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("crm.activities.empty")} description={t("crm.activities.emptyHint")} />
      ) : (
        <>
          <Table
            caption={t("crm.activities.caption")}
            getRowKey={(a) => String(a.id)}
            rows={rows}
            columns={[
              { key: "when", header: t("crm.activities.columns.when"), render: (a) => formatDateTime(a.occurred_at) },
              { key: "kind", header: t("crm.activities.columns.kind"), render: (a) => crmLabel(CRM_ACTIVITY_KIND_LABELS, a.kind, t) },
              {
                key: "account",
                header: t("crm.activities.columns.account"),
                render: (a) => (
                  <Link href={crmAccountHref(a.account)} className="text-primary-700 underline">
                    {a.account_name}
                  </Link>
                ),
              },
              {
                key: "summary",
                header: t("crm.activities.columns.summary"),
                render: (a) => {
                  const text = a.title || a.summary || "";
                  return (
                    <span className="block max-w-64 truncate" title={text}>
                      {text || t("crm.common.none")}
                    </span>
                  );
                },
              },
              {
                key: "result",
                header: t("crm.activities.columns.result"),
                render: (a) => (a.result ? crmLabel(CRM_RESULT_LABELS, a.result, t) : t("crm.common.none")),
              },
              {
                key: "contacts",
                header: t("crm.activities.columns.contacts"),
                render: (a) => a.contacts_detail.map((c) => c.name).join(", ") || t("crm.common.none"),
              },
              { key: "owner", header: t("crm.activities.columns.owner"), render: (a) => a.owner_detail?.name ?? t("crm.common.none") },
              {
                key: "followUp",
                header: t("crm.activities.columns.followUp"),
                render: (a) =>
                  a.has_follow_up ? (
                    <Badge tone="success">{t("crm.activities.hasFollowUp")}</Badge>
                  ) : (
                    <span className="text-text-secondary">{t("crm.activities.noFollowUp")}</span>
                  ),
              },
              {
                key: "actions",
                header: <span className="sr-only">{t("common.actions")}</span>,
                render: (a) => (
                  <div className="flex gap-1">
                    <Button type="button" variant="secondary" onClick={() => setSelected(a)}>
                      {t("crm.activities.open")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        remove.reset();
                        setDeleting(a);
                      }}
                    >
                      {t("crm.activities.delete")}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
          <Pager
            page={page}
            count={count}
            onPage={setPage}
            labels={{
              previous: t("crm.activities.pager.previous"),
              next: t("crm.activities.pager.next"),
              summary: t("crm.activities.pager.summary", { page, pages, count }),
            }}
          />
        </>
      )}

      {selected ? <ActivityDialog key={selected.id} activity={selected} onClose={() => setSelected(null)} /> : null}

      <ConfirmDialog
        open={!!deleting}
        title={t("crm.activities.deleteTitle")}
        description={
          <>
            <p>{t("crm.activities.deleteBody", { name: deleting?.account_name ?? "" })}</p>
            {remove.isError ? (
              <p role="alert" className="mt-2 text-error">
                {errorText(remove.error)}
              </p>
            ) : null}
          </>
        }
        confirmLabel={t("crm.activities.deleteConfirm")}
        pending={remove.isPending}
        onCancel={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
