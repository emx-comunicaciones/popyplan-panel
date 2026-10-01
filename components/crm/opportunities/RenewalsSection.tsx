"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useCrmRenewals } from "@/hooks/useCrm";
import type { CrmRenewal } from "@/lib/api/crmTypes";
import { formatDate, formatMoney } from "@/lib/crm/format";
import { crmAccountHref, crmOpportunityHref } from "@/lib/crm/nav";

const linkClass = "text-primary-700 hover:underline";

/** Contratos próximos a renovar (punto 47 de la spec). */
export function RenewalsSection() {
  const t = useTranslations("crm.opportunities.renewals");
  const renewals = useCrmRenewals();
  return (
    <section aria-labelledby="crm-renewals-title" className="flex flex-col gap-2">
      <h2 id="crm-renewals-title" className="text-base font-semibold text-text-base">
        {t("title")}
      </h2>
      {renewals.isLoading ? <p className="text-sm text-text-secondary">{t("loading")}</p> : null}
      {renewals.isError ? <ErrorState title={t("error")} /> : null}
      {renewals.data && renewals.data.length === 0 ? <p className="text-sm text-text-secondary">{t("empty")}</p> : null}
      {renewals.data && renewals.data.length > 0 ? (
        <Table<CrmRenewal>
          caption={t("caption")}
          rows={renewals.data}
          getRowKey={(row) => String(row.id)}
          columns={[
            {
              key: "account",
              header: t("account"),
              render: (row) => (
                <Link href={crmAccountHref(row.account)} className={linkClass}>
                  {row.account_name}
                </Link>
              ),
            },
            {
              key: "opportunity",
              header: t("opportunity"),
              render: (row) => (
                <Link href={crmOpportunityHref(row.opportunity)} className={linkClass}>
                  {row.opportunity_name}
                </Link>
              ),
            },
            { key: "date", header: t("renewalDate"), render: (row) => formatDate(row.renewal_date) },
            { key: "days", header: t("daysLeft"), render: (row) => t("days", { count: row.days_left }) },
            { key: "amount", header: t("finalAmount"), render: (row) => formatMoney(row.final_amount) },
          ]}
        />
      ) : null}
    </section>
  );
}
