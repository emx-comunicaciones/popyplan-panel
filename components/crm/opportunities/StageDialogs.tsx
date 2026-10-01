"use client";

/**
 * Diálogos compartidos del cambio de fase de una oportunidad (pipeline y
 * ficha): perder exige un motivo (`move/` con `lost_reason`) y ganar
 * registra el contrato (`win/`). Ver `crm/services.py::move_opportunity` y
 * `win_opportunity` del backend. El diálogo se cierra solo al guardar; el
 * error se pinta dentro.
 */
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useMoveOpportunity, useWinOpportunity } from "@/hooks/useCrm";
import type { CrmStage } from "@/lib/api/crmTypes";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { CRM_LOST_REASONS, CRM_LOST_REASON_LABELS } from "@/lib/crm/labels";

import { CRM_ERROR_KEYS } from "../QuickActivityDialog";
import { crmInputClass, crmLabelClass } from "../common";

export interface StageTarget {
  id: number;
  name: string;
  /** Importe estimado: se propone como importe final del contrato. */
  amount?: string | null;
  product?: number | null;
}

interface DialogProps {
  target: StageTarget;
  stage: CrmStage;
  onClose: () => void;
  onDone: (stage: CrmStage) => void;
}

export function LostReasonDialog({ target, stage, onClose, onDone }: DialogProps) {
  const t = useTranslations();
  const titleId = useId();
  const move = useMoveOpportunity();
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason) return;
    move.mutate(
      { id: target.id, stage: stage.id, lost_reason: reason, lost_detail: detail.trim() },
      { onSuccess: () => onDone(stage) },
    );
  }

  return (
    <Dialog open titleId={titleId} title={t("crm.dialogs.lost.title", { name: target.name })} onClose={onClose} pending={move.isPending}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-text-secondary">{t("crm.dialogs.lost.intro")}</p>
        <div>
          <label htmlFor="crm-lost-reason" className={crmLabelClass}>
            {t("crm.dialogs.lost.reason")}
          </label>
          <select id="crm-lost-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={crmInputClass} required>
            <option value="">{t("crm.dialogs.lost.choose")}</option>
            {CRM_LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(CRM_LOST_REASON_LABELS[r])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="crm-lost-detail" className={crmLabelClass}>
            {t("crm.dialogs.lost.detail")}
          </label>
          <textarea id="crm-lost-detail" value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} className={crmInputClass} />
        </div>
        {move.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(move.error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={move.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!reason || move.isPending}>
            {move.isPending ? t("crm.common.saving") : t("crm.dialogs.lost.confirm")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function WinContractDialog({ target, stage, onClose, onDone }: DialogProps) {
  const t = useTranslations();
  const titleId = useId();
  const win = useWinOpportunity();
  const [finalAmount, setFinalAmount] = useState(target.amount && Number(target.amount) > 0 ? target.amount : "");
  const [awardedAt, setAwardedAt] = useState(today());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [fileNumber, setFileNumber] = useState("");
  const [notes, setNotes] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!finalAmount || !awardedAt) return;
    win.mutate(
      {
        id: target.id,
        final_amount: finalAmount,
        awarded_at: awardedAt,
        start_date: startDate || null,
        end_date: endDate || null,
        duration_months: duration ? Number(duration) : null,
        renewal_date: renewalDate || null,
        file_number: fileNumber.trim(),
        notes: notes.trim(),
        ...(target.product ? { product: target.product } : {}),
      },
      { onSuccess: () => onDone(stage) },
    );
  }

  return (
    <Dialog open titleId={titleId} title={t("crm.dialogs.win.title", { name: target.name })} onClose={onClose} pending={win.isPending} widthClassName="max-w-xl">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-text-secondary">{t("crm.dialogs.win.intro")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="crm-win-amount" className={crmLabelClass}>
              {t("crm.dialogs.win.finalAmount")}
            </label>
            <input id="crm-win-amount" type="number" min="0" step="0.01" inputMode="decimal" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} className={crmInputClass} required />
          </div>
          <div>
            <label htmlFor="crm-win-awarded" className={crmLabelClass}>
              {t("crm.dialogs.win.awardedAt")}
            </label>
            <input id="crm-win-awarded" type="date" value={awardedAt} onChange={(e) => setAwardedAt(e.target.value)} className={crmInputClass} required />
          </div>
          <div>
            <label htmlFor="crm-win-start" className={crmLabelClass}>
              {t("crm.dialogs.win.startDate")}
            </label>
            <input id="crm-win-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={crmInputClass} />
          </div>
          <div>
            <label htmlFor="crm-win-end" className={crmLabelClass}>
              {t("crm.dialogs.win.endDate")}
            </label>
            <input id="crm-win-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={crmInputClass} />
          </div>
          <div>
            <label htmlFor="crm-win-duration" className={crmLabelClass}>
              {t("crm.dialogs.win.duration")}
            </label>
            <input id="crm-win-duration" type="number" min="1" step="1" value={duration} onChange={(e) => setDuration(e.target.value)} className={crmInputClass} />
          </div>
          <div>
            <label htmlFor="crm-win-renewal" className={crmLabelClass}>
              {t("crm.dialogs.win.renewalDate")}
            </label>
            <input id="crm-win-renewal" type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} className={crmInputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="crm-win-file" className={crmLabelClass}>
              {t("crm.dialogs.win.fileNumber")}
            </label>
            <input id="crm-win-file" value={fileNumber} onChange={(e) => setFileNumber(e.target.value)} className={crmInputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="crm-win-notes" className={crmLabelClass}>
              {t("crm.dialogs.win.notes")}
            </label>
            <textarea id="crm-win-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={crmInputClass} />
          </div>
        </div>
        {win.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(win.error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={win.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!finalAmount || !awardedAt || win.isPending}>
            {win.isPending ? t("crm.common.saving") : t("crm.dialogs.win.confirm")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Cambio de fase de una oportunidad: las fases «perdido» y «ganado» abren
 * su diálogo; las demás mueven directamente. `dialog` va en el árbol de
 * quien lo usa; `error` es el de un movimiento directo.
 */
export function useStageChange(onMoved?: (target: StageTarget, stage: CrmStage) => void) {
  const move = useMoveOpportunity();
  const [pending, setPending] = useState<{ target: StageTarget; stage: CrmStage } | null>(null);

  function request(target: StageTarget, stage: CrmStage) {
    if (stage.kind === "lost" || stage.kind === "won") {
      move.reset();
      setPending({ target, stage });
      return;
    }
    move.mutate({ id: target.id, stage: stage.id }, { onSuccess: () => onMoved?.(target, stage) });
  }

  const close = () => setPending(null);
  const done = (stage: CrmStage) => {
    if (pending) onMoved?.(pending.target, stage);
    setPending(null);
  };

  const dialog = pending ? (
    pending.stage.kind === "lost" ? (
      <LostReasonDialog target={pending.target} stage={pending.stage} onClose={close} onDone={done} />
    ) : (
      <WinContractDialog target={pending.target} stage={pending.stage} onClose={close} onDone={done} />
    )
  ) : null;

  return {
    request,
    dialog,
    error: move.isError ? move.error : null,
    movingId: move.isPending ? (move.variables?.id ?? null) : null,
    reset: move.reset,
  };
}
