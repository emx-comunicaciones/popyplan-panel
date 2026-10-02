"use client";

/**
 * Entidades del CRM (`/plataforma/comercial/entidades`): listado con
 * búsqueda, filtros, orden y paginación; alta, importación y exportación.
 * Cada comercial ve solo las suyas (lo decide el backend); dirección ve
 * todas y puede filtrar por responsable.
 */
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { AccountCreateDialog } from "@/components/crm/accounts/AccountCreateDialog";
import { AccountImportDialog } from "@/components/crm/accounts/AccountImportDialog";
import { DaysAgoText } from "@/components/crm/accounts/shared";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { downloadCrmExport, useCrmAccounts, useCrmStages, useCrmTags, type QueryParams } from "@/hooks/useCrm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { CrmAccount } from "@/lib/api/crmTypes";
import { daysAgo, formatDate, formatMoney } from "@/lib/crm/format";
import { CRM_ACCOUNT_KINDS, CRM_ACCOUNT_KIND_LABELS, CRM_INTERESTS, CRM_INTEREST_LABELS } from "@/lib/crm/labels";
import { CRM_BASE, crmAccountHref } from "@/lib/crm/nav";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { CRM_ERROR_KEYS } from "./QuickActivityDialog";
import { CrmUserSelect, InterestMeter, StageBadge, crmInputClass, crmLabelClass } from "./common";

export interface CrmAccountsViewProps {
  isManager: boolean;
  userId: number;
}

const PAGE_SIZE = 25;
const ORDERINGS = ["name", "-last_activity", "next_activity", "-population", "-open_value"] as const;
const ORDERING_LABELS: Record<(typeof ORDERINGS)[number], string> = {
  name: "crm.accounts.ordering.name",
  "-last_activity": "crm.accounts.ordering.lastActivity",
  next_activity: "crm.accounts.ordering.nextActivity",
  "-population": "crm.accounts.ordering.population",
  "-open_value": "crm.accounts.ordering.openValue",
};

interface Filters {
  q: string;
  region: string;
  province: string;
  kind: string;
  stage: string;
  interest: string;
  tag: string;
  owner: number | null;
  client: string;
  never: boolean;
  days: string;
  ordering: string;
}

const NO_FILTERS: Filters = {
  q: "",
  region: "",
  province: "",
  kind: "",
  stage: "",
  interest: "",
  tag: "",
  owner: null,
  client: "",
  never: false,
  days: "",
  ordering: "name",
};

export function CrmAccountsView({ isManager }: CrmAccountsViewProps) {
  const t = useTranslations();
  const ta = useTranslations("crm.accounts");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);

  const q = useDebouncedValue(filters.q, 300);
  const region = useDebouncedValue(filters.region, 300);
  const province = useDebouncedValue(filters.province, 300);
  const days = useDebouncedValue(filters.days, 300);
  const stages = useCrmStages();
  const tags = useCrmTags();

  const filterParams: QueryParams = {
    q: q.trim(),
    region: region.trim(),
    province: province.trim(),
    kind: filters.kind,
    stage: filters.stage,
    interest: filters.interest,
    tag: filters.tag,
    owner: isManager ? filters.owner : null,
    client: filters.client,
    never_contacted: filters.never ? "true" : "",
    days_without_contact: days.trim(),
    ordering: filters.ordering,
  };
  const accounts = useCrmAccounts({ ...filterParams, page, page_size: PAGE_SIZE });

  function update(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  async function exportCsv() {
    setExportError(null);
    try {
      await downloadCrmExport("accounts", filterParams);
    } catch (error) {
      setExportError(error);
    }
  }

  const count = accounts.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const select = (id: string, label: string, value: string, onChange: (v: string) => void, options: { value: string; label: string }[]) => (
    <div>
      <label htmlFor={id} className={crmLabelClass}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={crmInputClass}>
        <option value="">{ta("filters.all")}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-text-base">{ta("title")}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href={`${CRM_BASE}/atencion`} className="text-sm font-medium text-primary-700 underline">
            {ta("needAttention")}
          </Link>
          <Button type="button" variant="secondary" onClick={() => setImporting(true)}>
            {ta("import.open")}
          </Button>
          <Button type="button" variant="secondary" onClick={exportCsv}>
            {ta("export")}
          </Button>
          <Button type="button" onClick={() => setCreating(true)}>
            {ta("create.open")}
          </Button>
        </div>
      </div>
      {exportError ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(exportError as never, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
        </p>
      ) : null}

      <div>
        <label htmlFor="crm-accounts-q" className={crmLabelClass}>
          {ta("filters.search")}
        </label>
        <div className="flex gap-2">
          <input
            id="crm-accounts-q"
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            className={crmInputClass}
          />
          <Button
            type="button"
            variant="secondary"
            className="md:hidden"
            aria-expanded={showFilters}
            aria-controls="crm-accounts-filters"
            onClick={() => setShowFilters((v) => !v)}
          >
            {ta("filters.toggle")}
          </Button>
        </div>
      </div>

      <div
        id="crm-accounts-filters"
        className={`${showFilters ? "grid" : "hidden"} grid-cols-1 gap-3 rounded-lg border border-border bg-white p-3 sm:grid-cols-2 md:grid lg:grid-cols-4`}
      >
        <div>
          <label htmlFor="crm-accounts-region" className={crmLabelClass}>
            {ta("filters.region")}
          </label>
          <input id="crm-accounts-region" value={filters.region} onChange={(e) => update({ region: e.target.value })} className={crmInputClass} />
        </div>
        <div>
          <label htmlFor="crm-accounts-province" className={crmLabelClass}>
            {ta("filters.province")}
          </label>
          <input id="crm-accounts-province" value={filters.province} onChange={(e) => update({ province: e.target.value })} className={crmInputClass} />
        </div>
        {select("crm-accounts-kind", ta("filters.kind"), filters.kind, (kind) => update({ kind }),
          CRM_ACCOUNT_KINDS.map((k) => ({ value: k, label: t(CRM_ACCOUNT_KIND_LABELS[k]) })))}
        {select("crm-accounts-stage", ta("filters.stage"), filters.stage, (stage) => update({ stage }),
          (stages.data ?? []).map((s) => ({ value: String(s.id), label: s.name })))}
        {select("crm-accounts-interest", ta("filters.interest"), filters.interest, (interest) => update({ interest }),
          CRM_INTERESTS.map((i) => ({ value: i, label: t(CRM_INTEREST_LABELS[i]) })))}
        {select("crm-accounts-tag", ta("filters.tag"), filters.tag, (tag) => update({ tag }),
          (tags.data ?? []).map((tag) => ({ value: String(tag.id), label: tag.name })))}
        {isManager ? (
          <CrmUserSelect
            id="crm-accounts-owner"
            label={ta("filters.owner")}
            value={filters.owner}
            onChange={(owner) => update({ owner })}
            allowEmpty
            emptyLabel={ta("filters.all")}
          />
        ) : null}
        {select("crm-accounts-client", ta("filters.client"), filters.client, (client) => update({ client }), [
          { value: "true", label: ta("filters.clientYes") },
          { value: "false", label: ta("filters.clientNo") },
        ])}
        <div>
          <label htmlFor="crm-accounts-days" className={crmLabelClass}>
            {ta("filters.days")}
          </label>
          <input id="crm-accounts-days" type="number" min={0} value={filters.days} onChange={(e) => update({ days: e.target.value })} className={crmInputClass} />
        </div>
        <div className="flex items-end">
          <label className="inline-flex min-h-8 items-center gap-1.5 text-sm">
            <input type="checkbox" checked={filters.never} onChange={(e) => update({ never: e.target.checked })} />
            {ta("filters.never")}
          </label>
        </div>
        <div>
          <label htmlFor="crm-accounts-ordering" className={crmLabelClass}>
            {ta("filters.ordering")}
          </label>
          <select id="crm-accounts-ordering" value={filters.ordering} onChange={(e) => update({ ordering: e.target.value })} className={crmInputClass}>
            {ORDERINGS.map((o) => (
              <option key={o} value={o}>
                {t(ORDERING_LABELS[o])}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="button" variant="secondary" onClick={() => update(NO_FILTERS)} disabled={!filtered}>
            {ta("filters.clear")}
          </Button>
        </div>
      </div>

      {accounts.isLoading ? <p className="text-sm text-text-secondary">{t("crm.common.loading")}</p> : null}
      {accounts.isError ? (
        <ErrorState
          title={ta("loadError")}
          description={errorKindText(accounts.error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
          action={<Button type="button" variant="secondary" onClick={() => accounts.refetch()}>{t("common.retry")}</Button>}
        />
      ) : null}
      {accounts.data && accounts.data.results.length === 0 ? (
        <EmptyState title={filtered ? ta("emptyFiltered") : ta("empty")} />
      ) : null}
      {accounts.data && accounts.data.results.length > 0 ? (
        <>
          <p className="text-sm text-text-secondary" role="status">
            {ta("count", { count })}
          </p>
          <Table<CrmAccount>
            caption={ta("caption")}
            rows={accounts.data.results}
            getRowKey={(row) => String(row.id)}
            columns={[
              {
                key: "name",
                header: ta("columns.name"),
                render: (row) => (
                  <Link href={crmAccountHref(row.id)} className="font-medium text-primary-700 underline">
                    {row.name}
                  </Link>
                ),
              },
              {
                key: "place",
                header: ta("columns.place"),
                render: (row) => [row.place?.name, row.province].filter(Boolean).join(" · ") || "—",
              },
              { key: "population", header: ta("columns.population"), render: (row) => (row.population != null ? row.population.toLocaleString() : "—") },
              { key: "owner", header: ta("columns.owner"), render: (row) => row.owner?.name ?? "—" },
              { key: "stage", header: ta("columns.stage"), render: (row) => <StageBadge stage={row.stage} /> },
              { key: "interest", header: ta("columns.interest"), render: (row) => <InterestMeter value={row.interest} /> },
              { key: "last", header: ta("columns.lastActivity"), render: (row) => <DaysAgoText days={daysAgo(row.last_activity_at)} /> },
              { key: "next", header: ta("columns.nextActivity"), render: (row) => formatDate(row.next_activity_at) },
              { key: "value", header: ta("columns.openValue"), render: (row) => formatMoney(row.open_value) },
              {
                key: "tags",
                header: ta("columns.tags"),
                render: (row) => (row.tags.length ? row.tags.map((tag) => tag.name).join(", ") : "—"),
              },
            ]}
          />
          <nav aria-label={ta("pagination.label")} className="flex items-center justify-between gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {ta("pagination.previous")}
            </Button>
            <span className="text-sm text-text-secondary">{ta("pagination.page", { page, pages })}</span>
            <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              {ta("pagination.next")}
            </Button>
          </nav>
        </>
      ) : null}

      {creating ? <AccountCreateDialog isManager={isManager} onClose={() => setCreating(false)} /> : null}
      {importing ? <AccountImportDialog isManager={isManager} onClose={() => setImporting(false)} /> : null}
    </section>
  );
}
