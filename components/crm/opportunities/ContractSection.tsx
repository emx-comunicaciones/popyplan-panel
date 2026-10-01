"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useUpdateContract } from "@/hooks/useCrm";
import type { CrmContract } from "@/lib/api/crmTypes";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { crmInputClass, crmLabelClass } from "../common";
import { CRM_ERROR_KEYS } from "../QuickActivityDialog";

/** Contrato de una oportunidad ganada (editable, incluida la fecha de renovación). */
export function ContractSection({ contract }: { contract: CrmContract }) {
  const t = useTranslations("crm.opportunityDetail.contract");
  const tAll = useTranslations();
  const update = useUpdateContract();
  const [finalAmount, setFinalAmount] = useState(contract.final_amount ?? "");
  const [awardedAt, setAwardedAt] = useState(contract.awarded_at ?? "");
  const [startDate, setStartDate] = useState(contract.start_date ?? "");
  const [endDate, setEndDate] = useState(contract.end_date ?? "");
  const [duration, setDuration] = useState(contract.duration_months ? String(contract.duration_months) : "");
  const [renewalDate, setRenewalDate] = useState(contract.renewal_date ?? "");
  const [fileNumber, setFileNumber] = useState(contract.file_number ?? "");
  const [notes, setNotes] = useState(contract.notes ?? "");
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!finalAmount || !awardedAt) return;
    setSaved(false);
    update.mutate(
      {
        id: contract.id,
        final_amount: finalAmount,
        awarded_at: awardedAt,
        start_date: startDate || null,
        end_date: endDate || null,
        duration_months: duration ? Number(duration) : null,
        renewal_date: renewalDate || null,
        file_number: fileNumber.trim(),
        notes: notes.trim(),
      },
      { onSuccess: () => setSaved(true) },
    );
  }

  const change = (setter: (value: string) => void) => (e: { target: { value: string } }) => {
    setSaved(false);
    setter(e.target.value);
  };

  return (
    <section aria-labelledby="crm-contract-title" className="flex flex-col gap-2">
      <h2 id="crm-contract-title" className="text-base font-semibold text-text-base">
        {t("title")}
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="crm-contract-amount" className={crmLabelClass}>
              {t("finalAmount")}
            </label>
            <input id="crm-contract-amount" type="number" min="0" step="0.01" value={finalAmount} onChange={change(setFinalAmount)} className={crmInputClass} required />
          </div>
          <div>
            <label htmlFor="crm-contract-awarded" className={crmLabelClass}>
              {t("awardedAt")}
            </label>
            <input id="crm-contract-awarded" type="date" value={awardedAt} onChange={change(setAwardedAt)} className={crmInputClass} required />
          </div>
          <div>
            <label htmlFor="crm-contract-duration" className={crmLabelClass}>
              {t("duration")}
            </label>
            <input id="crm-contract-duration" type="number" min="1" step="1" value={duration} onChange={change(setDuration)} className={crmInputClass} />
          </div>
          <div>
            <label htmlFor="crm-contract-start" className={crmLabelClass}>
              {t("startDate")}
            </label>
            <input id="crm-contract-start" type="date" value={startDate} onChange={change(setStartDate)} className={crmInputClass} />
          </div>
          <div>
            <label htmlFor="crm-contract-end" className={crmLabelClass}>
              {t("endDate")}
            </label>
            <input id="crm-contract-end" type="date" value={endDate} onChange={change(setEndDate)} className={crmInputClass} />
          </div>
          <div>
            <label htmlFor="crm-contract-renewal" className={crmLabelClass}>
              {t("renewalDate")}
            </label>
            <input id="crm-contract-renewal" type="date" value={renewalDate} onChange={change(setRenewalDate)} className={crmInputClass} />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="crm-contract-file" className={crmLabelClass}>
              {t("fileNumber")}
            </label>
            <input id="crm-contract-file" value={fileNumber} onChange={change(setFileNumber)} className={crmInputClass} />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="crm-contract-notes" className={crmLabelClass}>
              {t("notes")}
            </label>
            <textarea id="crm-contract-notes" value={notes} onChange={change(setNotes)} rows={3} className={crmInputClass} />
          </div>
        </div>
        {update.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(update.error, CRM_ERROR_KEYS, tAll, "errors.crm.desconocido")}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm text-success">
            {t("saved")}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={update.isPending || !finalAmount || !awardedAt}>
            {update.isPending ? tAll("crm.common.saving") : tAll("crm.common.save")}
          </Button>
        </div>
      </form>
    </section>
  );
}
