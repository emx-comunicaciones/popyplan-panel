"use client";

/**
 * Oportunidades: filtros, orden, tabla paginada, alta y contratos
 * próximos a renovar. La ficha vive en `CrmOpportunityDetailView`.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useCrmCatalog, useCrmOpportunities, useCrmStages, useCrmUsers } from "@/hooks/useCrm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { CrmOpportunity } from "@/lib/api/crmTypes";
import { formatDate, formatMoney } from "@/lib/crm/format";
import { CRM_STAGE_KIND_LABELS } from "@/lib/crm/labels";
import { crmAccountHref, crmOpportunityHref } from "@/lib/crm/nav";

import { StageBadge, crmInputClass } from "./common";
import { NewOpportunityDialog } from "./opportunities/NewOpportunityDialog";
import { RenewalsSection } from "./opportunities/RenewalsSection";

export interface CrmOpportunitiesViewProps {
  isManager: boolean;
  userId: number;
}

const STATUSES = ["open", "won", "lost", "paused"] as const;
const ORDERINGS = [
  { value: "-created", key: "orderCreated" },
  { value: "-amount", key: "orderAmountDesc" },
  { value: "amount", key: "orderAmountAsc" },
  { value: "close", key: "orderClose" },
] as const;

export function CrmOpportunitiesView({ isManager }: CrmOpportunitiesViewProps) {
  const t = useTranslations("crm.opportunities");
  const tAll = useTranslations();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [stage, setStage] = useState("");
  const [owner, setOwner] = useState("");
  const [product, setProduct] = useState("");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("-created");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useDebouncedValue(search.trim(), 300);

  const stages = useCrmStages();
  const users = useCrmUsers();
  const products = useCrmCatalog("product");
  const list = useCrmOpportunities({
    status,
    opportunity_stage: stage,
    owner,
    product,
    q,
    ordering,
    page: page > 1 ? page : undefined,
  });

  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const label = "mb-1 block text-xs font-medium text-text-form";
  const field = `${crmInputClass} min-h-8`;
  const total = list.data?.count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text-base">{tAll("pages.plataforma.comercialOportunidades.title")}</h1>
        <Button type="button" onClick={() => setCreating(true)}>
          {t("newButton")}
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-3" aria-label={t("filters")} onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="crm-opps-q" className={label}>
            {t("search")}
          </label>
          <input id="crm-opps-q" type="search" value={search} onChange={(e) => reset(setSearch)(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="crm-opps-status" className={label}>
            {t("status")}
          </label>
          <select id="crm-opps-status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={field}>
            <option value="">{t("allStatuses")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tAll(CRM_STAGE_KIND_LABELS[s])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="crm-opps-stage" className={label}>
            {t("stage")}
          </label>
          <select id="crm-opps-stage" value={stage} onChange={(e) => reset(setStage)(e.target.value)} className={field}>
            <option value="">{t("allStages")}</option>
            {stages.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {isManager ? (
          <div>
            <label htmlFor="crm-opps-owner" className={label}>
              {t("owner")}
            </label>
            <select id="crm-opps-owner" value={owner} onChange={(e) => reset(setOwner)(e.target.value)} className={field}>
              <option value="">{t("allOwners")}</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="crm-opps-product" className={label}>
            {t("product")}
          </label>
          <select id="crm-opps-product" value={product} onChange={(e) => reset(setProduct)(e.target.value)} className={field}>
            <option value="">{t("allProducts")}</option>
            {products.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="crm-opps-order" className={label}>
            {t("ordering")}
          </label>
          <select id="crm-opps-order" value={ordering} onChange={(e) => reset(setOrdering)(e.target.value)} className={field}>
            {ORDERINGS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </select>
        </div>
      </form>

      {list.isLoading ? <p className="text-sm text-text-secondary">{tAll("crm.common.loading")}</p> : null}
      {list.isError ? <ErrorState title={t("loadError")} /> : null}
      {list.data && list.data.results.length === 0 ? <p className="text-sm text-text-secondary">{t("empty")}</p> : null}
      {list.data && list.data.results.length > 0 ? (
        <>
          <Table<CrmOpportunity>
            caption={t("caption")}
            rows={list.data.results}
            getRowKey={(row) => String(row.id)}
            columns={[
              {
                key: "name",
                header: t("colName"),
                render: (row) => (
                  <Link href={crmOpportunityHref(row.id)} className="font-medium text-primary-700 hover:underline">
                    {row.name}
                  </Link>
                ),
              },
              {
                key: "account",
                header: t("colAccount"),
                render: (row) => (
                  <Link href={crmAccountHref(row.account as number)} className="text-primary-700 hover:underline">
                    {row.account_name}
                  </Link>
                ),
              },
              { key: "product", header: t("colProduct"), render: (row) => row.product_name || "—" },
              { key: "stage", header: t("colStage"), render: (row) => <StageBadge stage={row.stage_detail} /> },
              { key: "estimated", header: t("colEstimated"), render: (row) => formatMoney(row.estimated_amount) },
              { key: "proposal", header: t("colProposal"), render: (row) => formatMoney(row.proposal_amount) },
              { key: "final", header: t("colFinal"), render: (row) => formatMoney(row.final_amount) },
              { key: "close", header: t("colClose"), render: (row) => formatDate(row.expected_close_date) },
              { key: "owner", header: t("colOwner"), render: (row) => row.owner_detail?.name ?? "—" },
              {
                key: "days",
                header: t("colDays"),
                render: (row) => (row.days_in_stage === null ? "—" : t("days", { count: row.days_in_stage })),
              },
            ]}
          />
          <nav aria-label={t("pagination")} className="flex items-center justify-between gap-2 text-sm">
            <span>{t("total", { count: total })}</span>
            <span className="flex items-center gap-2">
              <Button type="button" variant="secondary" disabled={!list.data.previous} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                {t("previous")}
              </Button>
              <span>{t("page", { page })}</span>
              <Button type="button" variant="secondary" disabled={!list.data.next} onClick={() => setPage((p) => p + 1)}>
                {t("next")}
              </Button>
            </span>
          </nav>
        </>
      ) : null}

      <RenewalsSection />

      {creating ? (
        <NewOpportunityDialog
          isManager={isManager}
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            router.push(crmOpportunityHref(created.id));
          }}
        />
      ) : null}
    </div>
  );
}
