"use client";

/**
 * Ficha de una oportunidad: cabecera con cambio de fase, edición agrupada
 * (General / Contratación pública), propuestas por versión, contrato,
 * actividades y borrado (solo dirección comercial, borrado lógico).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useCrmActivities, useCrmOpportunity, useCrmStages, useDeleteOpportunity } from "@/hooks/useCrm";
import type { CrmActivity } from "@/lib/api/crmTypes";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatDate, formatDateTime, formatMoney } from "@/lib/crm/format";
import { CRM_ACTIVITY_KIND_LABELS, CRM_LOST_REASON_LABELS, crmLabel } from "@/lib/crm/labels";
import { crmAccountHref, crmSectionHref } from "@/lib/crm/nav";

import { InterestMeter, StageBadge, crmInputClass, crmLabelClass } from "./common";
import { useCrmContext } from "./CrmShell";
import { CRM_ERROR_KEYS } from "./QuickActivityDialog";
import { ContractSection } from "./opportunities/ContractSection";
import { OpportunityForm } from "./opportunities/OpportunityForm";
import { ProposalsSection } from "./opportunities/ProposalsSection";
import { useStageChange } from "./opportunities/StageDialogs";

export interface CrmOpportunityDetailViewProps {
  id: number;
  isManager: boolean;
  userId: number;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="text-sm font-medium text-text-base">{children}</dd>
    </div>
  );
}

export function CrmOpportunityDetailView({ id, isManager }: CrmOpportunityDetailViewProps) {
  const t = useTranslations("crm.opportunityDetail");
  const tAll = useTranslations();
  const router = useRouter();
  const { openActivity } = useCrmContext();
  const opportunity = useCrmOpportunity(id);
  const stages = useCrmStages();
  const activities = useCrmActivities({ opportunity: id });
  const remove = useDeleteOpportunity();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState("");
  const stageChange = useStageChange((_target, stage) => setStatus(t("moved", { stage: stage.name })));

  if (opportunity.isLoading) {
    return <p className="text-sm text-text-secondary">{tAll("crm.common.loading")}</p>;
  }
  if (opportunity.isError || !opportunity.data) {
    return (
      <ErrorState
        title={errorKindText(opportunity.error, CRM_ERROR_KEYS, tAll, "errors.crm.desconocido")}
        action={
          <Link href={crmSectionHref("oportunidades")} className="text-sm text-primary-700 hover:underline">
            {t("backToList")}
          </Link>
        }
      />
    );
  }

  const opp = opportunity.data;
  const accountId = opp.account as number;
  const isLost = opp.stage_detail.kind === "lost";
  const stageList = (stages.data ?? []).filter((s) => s.is_active !== false || s.id === opp.stage);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <p className="text-sm">
          <Link href={crmSectionHref("oportunidades")} className="text-primary-700 hover:underline">
            {t("backToList")}
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-text-base">{opp.name}</h1>
          <StageBadge stage={opp.stage_detail} />
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label={t("header.account")}>
            <Link href={crmAccountHref(accountId)} className="text-primary-700 hover:underline">
              {opp.account_name}
            </Link>
          </Fact>
          <Fact label={t("header.owner")}>{opp.owner_detail?.name ?? "—"}</Fact>
          <Fact label={t("header.estimated")}>{formatMoney(opp.estimated_amount)}</Fact>
          <Fact label={t("header.proposal")}>{formatMoney(opp.proposal_amount)}</Fact>
          <Fact label={t("header.final")}>{formatMoney(opp.final_amount)}</Fact>
          <Fact label={t("header.expectedClose")}>{formatDate(opp.expected_close_date)}</Fact>
          <Fact label={t("header.daysInStage")}>
            {opp.days_in_stage === null ? "—" : t("header.days", { count: opp.days_in_stage })}
          </Fact>
          <Fact label={t("header.interest")}>
            <InterestMeter value={opp.interest} />
          </Fact>
        </dl>

        {isLost ? (
          <div className="rounded-md border border-error/30 bg-error/5 p-2 text-sm">
            <p className="font-medium text-error">
              {t("lost.title", { reason: crmLabel(CRM_LOST_REASON_LABELS, opp.lost_reason, tAll) || "—" })}
            </p>
            {opp.lost_detail ? <p className="text-text-base">{opp.lost_detail}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="crm-opp-stage" className={crmLabelClass}>
              {t("stageChange")}
            </label>
            <select
              id="crm-opp-stage"
              value={opp.stage}
              onChange={(e) => {
                const target = stageList.find((s) => s.id === Number(e.target.value));
                if (!target || target.id === opp.stage) return;
                setStatus("");
                stageChange.request(
                  { id: opp.id, name: opp.name, amount: opp.proposal_amount ?? opp.estimated_amount, product: opp.product },
                  target,
                );
              }}
              disabled={stageChange.movingId !== null}
              className={`${crmInputClass} min-h-8 min-w-48`}
            >
              {stageList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={() => openActivity({ account: { id: accountId, name: opp.account_name }, opportunity: opp.id })}>
            {t("registerActivity")}
          </Button>
          {isManager ? (
            <Button type="button" variant="danger" onClick={() => { remove.reset(); setConfirmDelete(true); }}>
              {t("delete.button")}
            </Button>
          ) : null}
        </div>
        <p role="status" className="min-h-4 text-sm text-text-base">
          {status}
        </p>
        {stageChange.error ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(stageChange.error, CRM_ERROR_KEYS, tAll, "errors.crm.desconocido")}
          </p>
        ) : null}
      </header>

      <OpportunityForm key={`${opp.id}-${opp.updated_at}`} opportunity={opp} isManager={isManager} />

      <ProposalsSection opportunity={opp.id} product={opp.product ?? null} />

      {opp.contract ? <ContractSection key={opp.contract.id} contract={opp.contract} /> : null}

      <section aria-labelledby="crm-opp-activities" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="crm-opp-activities" className="text-base font-semibold text-text-base">
            {t("activities.title")}
          </h2>
          <Button type="button" variant="secondary" onClick={() => openActivity({ account: { id: accountId, name: opp.account_name }, opportunity: opp.id })}>
            {t("registerActivity")}
          </Button>
        </div>
        {activities.isLoading ? <p className="text-sm text-text-secondary">{tAll("crm.common.loading")}</p> : null}
        {activities.isError ? <ErrorState title={t("activities.error")} /> : null}
        {activities.data && activities.data.results.length === 0 ? (
          <p className="text-sm text-text-secondary">{t("activities.empty")}</p>
        ) : null}
        {activities.data && activities.data.results.length > 0 ? (
          <Table<CrmActivity>
            caption={t("activities.caption")}
            rows={activities.data.results}
            getRowKey={(row) => String(row.id)}
            columns={[
              { key: "date", header: t("activities.date"), render: (row) => formatDateTime(row.occurred_at) },
              { key: "kind", header: t("activities.kind"), render: (row) => crmLabel(CRM_ACTIVITY_KIND_LABELS, row.kind, tAll) },
              { key: "title", header: t("activities.summary"), render: (row) => row.title || row.summary || "—" },
              { key: "owner", header: t("activities.owner"), render: (row) => row.owner_detail?.name ?? "—" },
            ]}
          />
        ) : null}
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title={t("delete.title", { name: opp.name })}
        description={
          <>
            <p>{t("delete.description")}</p>
            {remove.isError ? (
              <p role="alert" className="mt-2 text-error">
                {errorKindText(remove.error, CRM_ERROR_KEYS, tAll, "errors.crm.desconocido")}
              </p>
            ) : null}
          </>
        }
        confirmLabel={t("delete.confirm")}
        pending={remove.isPending}
        onCancel={() => { remove.reset(); setConfirmDelete(false); }}
        onConfirm={() =>
          remove.mutate(opp.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              router.push(crmSectionHref("oportunidades"));
            },
          })
        }
      />
      {stageChange.dialog}
    </div>
  );
}
