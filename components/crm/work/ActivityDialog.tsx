"use client";

/**
 * Detalle de una actividad y edición de lo que se puede corregir a
 * posteriori. El registro original no se reescribe: el backend añade un
 * evento «actividad editada» al historial de la entidad (CRM.md).
 */
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useUpdateActivity } from "@/hooks/useCrm";
import type { CrmActivity } from "@/lib/api/crmTypes";
import { formatDateTime } from "@/lib/crm/format";
import {
  CRM_ACTIVITY_KIND_LABELS,
  CRM_INTERESTS,
  CRM_INTEREST_LABELS,
  CRM_RESULTS,
  CRM_RESULT_LABELS,
  crmLabel,
} from "@/lib/crm/labels";
import { crmAccountHref } from "@/lib/crm/nav";

import { crmInputClass, crmLabelClass } from "../common";
import { useCrmErrorText } from "./shared";

export function ActivityDialog({ activity, onClose }: { activity: CrmActivity; onClose: () => void }) {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const titleId = useId();
  const update = useUpdateActivity();
  const [summary, setSummary] = useState(activity.summary ?? "");
  const [description, setDescription] = useState(activity.description ?? "");
  const [result, setResult] = useState<string>(activity.result ?? "");
  const [resultText, setResultText] = useState(activity.result_text ?? "");
  const [interest, setInterest] = useState<string>(activity.interest_after ?? "");
  const [comments, setComments] = useState(activity.internal_comments ?? "");
  const [duration, setDuration] = useState(
    activity.duration_minutes === null || activity.duration_minutes === undefined ? "" : String(activity.duration_minutes),
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const minutes = duration.trim() === "" ? null : Number(duration);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0)) return;
    update.mutate(
      {
        id: activity.id,
        summary,
        description,
        result: result as CrmActivity["result"],
        result_text: resultText,
        interest_after: interest as CrmActivity["interest_after"],
        internal_comments: comments,
        duration_minutes: minutes,
      },
      { onSuccess: onClose },
    );
  }

  const contacts = activity.contacts_detail.map((c) => c.name).join(", ");

  return (
    <Dialog
      open
      titleId={titleId}
      title={t("crm.activities.dialog.title")}
      onClose={onClose}
      pending={update.isPending}
      widthClassName="max-w-xl"
    >
      <dl className="mb-3 grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-medium text-text-form">{t("crm.activities.dialog.account")}</dt>
        <dd>
          <Link href={crmAccountHref(activity.account)} className="text-primary-700 underline">
            {activity.account_name}
          </Link>
        </dd>
        <dt className="font-medium text-text-form">{t("crm.activities.dialog.kind")}</dt>
        <dd>{crmLabel(CRM_ACTIVITY_KIND_LABELS, activity.kind, t)}</dd>
        <dt className="font-medium text-text-form">{t("crm.activities.dialog.when")}</dt>
        <dd>{formatDateTime(activity.occurred_at)}</dd>
        {activity.title ? (
          <>
            <dt className="font-medium text-text-form">{t("crm.activities.dialog.activityTitle")}</dt>
            <dd>{activity.title}</dd>
          </>
        ) : null}
        <dt className="font-medium text-text-form">{t("crm.activities.dialog.contacts")}</dt>
        <dd>{contacts || t("crm.common.none")}</dd>
        <dt className="font-medium text-text-form">{t("crm.activities.dialog.owner")}</dt>
        <dd>{activity.owner_detail?.name ?? t("crm.common.none")}</dd>
      </dl>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="rounded-md bg-border-light p-2 text-xs text-text-secondary">
          {t("crm.activities.dialog.historyNote")}
        </p>
        <div>
          <label htmlFor="crm-act-summary" className={crmLabelClass}>
            {t("crm.activities.dialog.summary")}
          </label>
          <textarea
            id="crm-act-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className={crmInputClass}
          />
        </div>
        <div>
          <label htmlFor="crm-act-description" className={crmLabelClass}>
            {t("crm.activities.dialog.description")}
          </label>
          <textarea
            id="crm-act-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={crmInputClass}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="crm-act-result" className={crmLabelClass}>
              {t("crm.activities.dialog.result")}
            </label>
            <select id="crm-act-result" value={result} onChange={(e) => setResult(e.target.value)} className={crmInputClass}>
              <option value="">{t("crm.common.none")}</option>
              {CRM_RESULTS.map((r) => (
                <option key={r} value={r}>
                  {t(CRM_RESULT_LABELS[r])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="crm-act-interest" className={crmLabelClass}>
              {t("crm.activities.dialog.interest")}
            </label>
            <select
              id="crm-act-interest"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              className={crmInputClass}
            >
              <option value="">{t("crm.common.none")}</option>
              {CRM_INTERESTS.map((i) => (
                <option key={i} value={i}>
                  {t(CRM_INTEREST_LABELS[i])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="crm-act-result-text" className={crmLabelClass}>
              {t("crm.activities.dialog.resultText")}
            </label>
            <input
              id="crm-act-result-text"
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
              className={crmInputClass}
            />
          </div>
          <div>
            <label htmlFor="crm-act-duration" className={crmLabelClass}>
              {t("crm.activities.dialog.duration")}
            </label>
            <input
              id="crm-act-duration"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={crmInputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="crm-act-comments" className={crmLabelClass}>
            {t("crm.activities.dialog.comments")}
          </label>
          <textarea
            id="crm-act-comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={2}
            className={crmInputClass}
          />
        </div>
        {update.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorText(update.error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={update.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? t("crm.common.saving") : t("crm.common.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
