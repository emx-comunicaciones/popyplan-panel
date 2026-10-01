"use client";

/**
 * Pestaña «Contratación»: lo que la administración ha comunicado sobre su
 * contratación pública (presupuesto, financiación, expediente, plazos…) de
 * cada oportunidad de la entidad, y el contrato y su renovación si se
 * ganó. El CRM no interpreta qué procedimiento corresponde: solo lo
 * recoge. Se edita en la ficha de la oportunidad.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCrmOpportunities } from "@/hooks/useCrm";
import type { CrmOpportunity } from "@/lib/api/crmTypes";
import { formatDate, formatMoney } from "@/lib/crm/format";
import { crmOpportunityHref } from "@/lib/crm/nav";

import { StageBadge } from "../../common";
import { PageNav, QueryBoundary, pageCount } from "../shared";

const PAGE_SIZE = 50;

function OpportunityProcurement({ opp }: { opp: CrmOpportunity }) {
  const t = useTranslations("crm.accountDetail.procurement");
  const tc = useTranslations("crm.accountDetail.procurement.flags");
  const funds = [
    opp.has_subsidy ? tc("subsidy") : "",
    opp.eu_funds ? tc("eu") : "",
    opp.regional_funds ? tc("regional") : "",
    opp.state_funds ? tc("state") : "",
  ].filter(Boolean);
  const dash = (value: string | null | undefined) => value || "—";
  const rows: [string, ReactNode][] = [
    [t("budget"), formatMoney(opp.available_budget)],
    [t("budgetLine"), dash(opp.budget_line)],
    [t("funding"), dash(opp.funding)],
    [t("funds"), funds.length ? funds.join(", ") : tc("none")],
    [t("fileNumber"), dash(opp.file_number)],
    [
      t("fileUrl"),
      opp.file_url ? (
        <a href={opp.file_url} target="_blank" rel="noopener noreferrer" className="break-all text-primary-700 underline">
          {opp.file_url}
        </a>
      ) : (
        "—"
      ),
    ],
    [t("procedure"), dash(opp.procedure_notes)],
    [t("tenderDate"), formatDate(opp.tender_date)],
    [t("deadline"), formatDate(opp.deadline)],
    [t("manager"), dash(opp.procurement_manager)],
    [t("requiredDocuments"), dash(opp.required_documents)],
    [t("notes"), dash(opp.procurement_notes)],
  ];
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Link href={crmOpportunityHref(opp.id)} className="text-primary-700 underline">
            {opp.name}
          </Link>
          <StageBadge stage={opp.stage_detail} />
        </span>
      }
    >
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-text-secondary">{label}</dt>
            <dd className="whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
      {opp.contract ? (
        <div className="mt-2 rounded-md border border-border bg-primary-100 p-2 text-sm">
          <p className="font-medium text-text-base">{t("contract")}</p>
          <p>{t("contractAmount", { amount: formatMoney(opp.contract.final_amount), date: formatDate(opp.contract.awarded_at) })}</p>
          <p>{t("renewal", { date: formatDate(opp.contract.renewal_date) })}</p>
        </div>
      ) : null}
      <p className="mt-2 text-sm">
        <Link href={crmOpportunityHref(opp.id)} className="font-medium text-primary-700 underline">
          {t("edit")}
        </Link>
      </p>
    </Card>
  );
}

export function ProcurementSection({ accountId }: { accountId: number }) {
  const t = useTranslations("crm.accountDetail.procurement");
  const [page, setPage] = useState(1);
  const query = useCrmOpportunities({ account: accountId, page, page_size: PAGE_SIZE });
  return (
    <QueryBoundary query={query}>
      {(data) =>
        data.results.length === 0 && page === 1 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <div className="flex flex-col gap-3">
            {data.results.map((opp) => (
              <OpportunityProcurement key={opp.id} opp={opp} />
            ))}
            <PageNav page={page} pages={pageCount(data.count, PAGE_SIZE)} onPage={setPage} />
          </div>
        )
      }
    </QueryBoundary>
  );
}
