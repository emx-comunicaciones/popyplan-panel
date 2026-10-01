"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useCreateProposal, useCrmProposals, useUpdateProposal } from "@/hooks/useCrm";
import type { CrmProposal, CrmProposalStatus } from "@/lib/api/crmTypes";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatDate, formatMoney } from "@/lib/crm/format";
import { CRM_PROPOSAL_STATUSES, CRM_PROPOSAL_STATUS_LABELS } from "@/lib/crm/labels";

import { crmInputClass, crmLabelClass } from "../common";
import { CRM_ERROR_KEYS } from "../QuickActivityDialog";

function NewProposalDialog({
  opportunity,
  previous,
  product,
  onClose,
}: {
  opportunity: number;
  previous: CrmProposal | null;
  product: number | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const titleId = useId();
  const create = useCreateProposal();
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(previous?.amount ?? "");
  const [duration, setDuration] = useState(previous?.duration_months ? String(previous.duration_months) : "");
  const [status, setStatus] = useState<string>("draft");
  const [notes, setNotes] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!amount || !date) return;
    create.mutate(
      {
        opportunity,
        number: number.trim(),
        date,
        amount,
        duration_months: duration ? Number(duration) : null,
        status: status as CrmProposalStatus,
        notes: notes.trim(),
        ...(product ? { product } : {}),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      titleId={titleId}
      title={t(previous ? "crm.opportunityDetail.proposals.newVersionTitle" : "crm.opportunityDetail.proposals.newTitle")}
      onClose={onClose}
      pending={create.isPending}
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="crm-prop-number" className={crmLabelClass}>
              {t("crm.opportunityDetail.proposals.number")}
            </label>
            <input id="crm-prop-number" value={number} onChange={(e) => setNumber(e.target.value)} className={crmInputClass} />
          </div>
          <div>
            <label htmlFor="crm-prop-date" className={crmLabelClass}>
              {t("crm.opportunityDetail.proposals.date")}
            </label>
            <input id="crm-prop-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={crmInputClass} required />
          </div>
          <div>
            <label htmlFor="crm-prop-amount" className={crmLabelClass}>
              {t("crm.opportunityDetail.proposals.amount")}
            </label>
            <input id="crm-prop-amount" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={crmInputClass} required />
          </div>
          <div>
            <label htmlFor="crm-prop-duration" className={crmLabelClass}>
              {t("crm.opportunityDetail.proposals.duration")}
            </label>
            <input id="crm-prop-duration" type="number" min="1" step="1" value={duration} onChange={(e) => setDuration(e.target.value)} className={crmInputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="crm-prop-status" className={crmLabelClass}>
              {t("crm.opportunityDetail.proposals.status")}
            </label>
            <select id="crm-prop-status" value={status} onChange={(e) => setStatus(e.target.value)} className={crmInputClass}>
              {CRM_PROPOSAL_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(CRM_PROPOSAL_STATUS_LABELS[value])}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="crm-prop-notes" className={crmLabelClass}>
              {t("crm.opportunityDetail.proposals.notes")}
            </label>
            <textarea id="crm-prop-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={crmInputClass} />
          </div>
        </div>
        {create.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(create.error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={create.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!amount || !date || create.isPending}>
            {create.isPending ? t("crm.common.saving") : t("crm.common.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Versiones de la propuesta de una oportunidad (v1, v2…). */
export function ProposalsSection({ opportunity, product }: { opportunity: number; product: number | null }) {
  const t = useTranslations();
  const proposals = useCrmProposals(opportunity);
  const update = useUpdateProposal();
  const [creating, setCreating] = useState(false);
  const rows = [...(proposals.data ?? [])].sort((a, b) => b.version - a.version);

  return (
    <section aria-labelledby="crm-proposals-title" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="crm-proposals-title" className="text-base font-semibold text-text-base">
          {t("crm.opportunityDetail.proposals.title")}
        </h2>
        <Button type="button" variant="secondary" onClick={() => setCreating(true)}>
          {t(rows.length ? "crm.opportunityDetail.proposals.newVersion" : "crm.opportunityDetail.proposals.new")}
        </Button>
      </div>
      {proposals.isLoading ? <p className="text-sm text-text-secondary">{t("crm.common.loading")}</p> : null}
      {proposals.isError ? <ErrorState title={t("crm.opportunityDetail.proposals.error")} /> : null}
      {proposals.data && rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{t("crm.opportunityDetail.proposals.empty")}</p>
      ) : null}
      {rows.length > 0 ? (
        <Table<CrmProposal>
          caption={t("crm.opportunityDetail.proposals.caption")}
          rows={rows}
          getRowKey={(row) => String(row.id)}
          columns={[
            {
              key: "version",
              header: t("crm.opportunityDetail.proposals.version"),
              render: (row) => t("crm.opportunityDetail.proposals.versionLabel", { version: row.version }),
            },
            { key: "number", header: t("crm.opportunityDetail.proposals.number"), render: (row) => row.number || "—" },
            { key: "date", header: t("crm.opportunityDetail.proposals.date"), render: (row) => formatDate(row.date) },
            { key: "amount", header: t("crm.opportunityDetail.proposals.amount"), render: (row) => formatMoney(row.amount) },
            {
              key: "duration",
              header: t("crm.opportunityDetail.proposals.duration"),
              render: (row) =>
                row.duration_months ? t("crm.opportunityDetail.proposals.months", { count: row.duration_months }) : "—",
            },
            {
              key: "status",
              header: t("crm.opportunityDetail.proposals.status"),
              render: (row) => (
                <select
                  aria-label={t("crm.opportunityDetail.proposals.statusAria", { version: row.version })}
                  value={row.status ?? "draft"}
                  onChange={(e) => update.mutate({ id: row.id, status: e.target.value as CrmProposalStatus })}
                  disabled={update.isPending}
                  className="min-h-8 rounded-md border border-border bg-white px-1.5 text-sm"
                >
                  {CRM_PROPOSAL_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {t(CRM_PROPOSAL_STATUS_LABELS[value])}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      ) : null}
      {update.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(update.error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
        </p>
      ) : null}
      {creating ? (
        <NewProposalDialog opportunity={opportunity} previous={rows[0] ?? null} product={product} onClose={() => setCreating(false)} />
      ) : null}
    </section>
  );
}
