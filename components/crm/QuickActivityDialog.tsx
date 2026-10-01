"use client";

/**
 * «Registrar actividad» en modo rápido (puntos 13, 36-38 de la spec): lo
 * justo para apuntar una visita en menos de un minuto, también desde el
 * móvil —entidad, tipo, contacto, resultado, resumen (escrito o
 * dictado), nivel de interés, adjuntos (fotos incluidas) y el siguiente
 * paso—. Lo demás se completa luego desde la actividad.
 *
 * El resumen se guarda como borrador en el navegador mientras se escribe
 * (`sessionStorage`, por si se cierra el diálogo sin querer) y se borra al
 * guardar. Los adjuntos se suben después de crear la actividad, ligados a
 * ella; si alguno falla, la actividad ya está guardada y se dice cuál.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { PickerOption } from "@/components/ui/SearchPicker";
import { useCreateActivity, useCrmAccountContacts, useUploadDocument } from "@/hooks/useCrm";
import { errorKindText } from "@/lib/i18n/errorKindText";
import {
  CRM_ACTIVITY_KINDS,
  CRM_ACTIVITY_KIND_LABELS,
  CRM_INTERESTS,
  CRM_INTEREST_LABELS,
  CRM_PRIORITIES,
  CRM_PRIORITY_LABELS,
  CRM_RESULTS,
  CRM_RESULT_LABELS,
} from "@/lib/crm/labels";
import { fromLocalInput, toLocalInput } from "@/lib/crm/format";

import { CrmAccountPicker, CrmUserSelect, crmInputClass, crmLabelClass } from "./common";

export interface QuickActivityPreset {
  account?: { id: number; name: string };
  opportunity?: number | null;
  kind?: string;
}

const DRAFT_KEY = "crm-activity-draft";
/** Recordatorio (punto 15): minutos antes → clave de su texto. */
export const CRM_REMINDER_LABELS: Record<number, string> = {
  0: "crm.reminders.m0",
  15: "crm.reminders.m15",
  60: "crm.reminders.m60",
  1440: "crm.reminders.m1440",
  2880: "crm.reminders.m2880",
};
const REMINDERS = [0, 15, 60, 1440, 2880];
export const CRM_ERROR_KEYS = {
  sin_acceso: "errors.crm.sinAcceso",
  invalido: "errors.crm.invalido",
  duplicado: "errors.crm.duplicado",
  no_encontrado: "errors.crm.noEncontrado",
  desconocido: "errors.crm.desconocido",
} as const;

function readDraft(): string {
  try {
    return window.sessionStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(value: string) {
  try {
    if (value) window.sessionStorage.setItem(DRAFT_KEY, value);
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Sin almacenamiento (modo privado): el borrador simplemente no se guarda.
  }
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function speechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

export function QuickActivityDialog({
  preset,
  userId,
  isManager,
  onClose,
}: {
  preset: QuickActivityPreset;
  userId: number;
  isManager: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const titleId = useId();
  const [account, setAccount] = useState<PickerOption | null>(
    preset.account ? { id: preset.account.id, label: preset.account.name } : null,
  );
  const [kind, setKind] = useState(preset.kind ?? "visit");
  const [contact, setContact] = useState<number | "">("");
  const [result, setResult] = useState("");
  const [summary, setSummary] = useState(() => readDraft());
  const [interest, setInterest] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [followUp, setFollowUp] = useState(true);
  const [followKind, setFollowKind] = useState("call");
  const [followTitle, setFollowTitle] = useState("");
  const [followAt, setFollowAt] = useState(() => {
    const date = new Date(Date.now() + 2 * 86_400_000);
    date.setHours(10, 0, 0, 0);
    return toLocalInput(date.toISOString());
  });
  const [followPriority, setFollowPriority] = useState("normal");
  const [followAssignee, setFollowAssignee] = useState<number | null>(userId || null);
  const [reminder, setReminder] = useState(60);
  const [listening, setListening] = useState(false);
  const [uploadFailed, setUploadFailed] = useState<string[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const contacts = useCrmAccountContacts(account?.id ?? null);
  const create = useCreateActivity();
  const upload = useUploadDocument();
  const Recognition = speechRecognition();

  useEffect(() => writeDraft(summary), [summary]);
  useEffect(() => () => recognitionRef.current?.stop(), []);

  function toggleDictation() {
    if (!Recognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = document.documentElement.lang || "es";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0].transcript).join(" ");
      setSummary((prev) => (prev ? `${prev} ${text}` : text));
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!account) return;
    const dueAt = fromLocalInput(followAt);
    const activity = await create
      .mutateAsync({
        account: account.id,
        opportunity: preset.opportunity ?? null,
        kind: kind as never,
        contacts: contact ? [contact] : [],
        result: (result || undefined) as never,
        summary,
        interest_after: (interest || undefined) as never,
        follow_up:
          followUp && dueAt
            ? {
                kind: followKind,
                title: followTitle,
                due_at: dueAt,
                priority: followPriority,
                assignee: followAssignee,
                reminder_minutes: reminder,
                contact: contact || null,
              }
            : null,
      })
      .catch(() => null);
    if (!activity) return;
    const failed: string[] = [];
    for (const file of files) {
      try {
        await upload.mutateAsync({
          file,
          account: account.id,
          activity: activity.id,
          opportunity: preset.opportunity ?? null,
          category: file.type.startsWith("image/") ? "photo" : "other",
        });
      } catch {
        failed.push(file.name);
      }
    }
    writeDraft("");
    if (failed.length) {
      setUploadFailed(failed);
      return;
    }
    onClose();
  }

  const pending = create.isPending || upload.isPending;

  if (uploadFailed.length) {
    return (
      <Dialog open titleId={titleId} title={t("crm.quick.title")} onClose={onClose}>
        <p role="alert" className="text-sm text-error">
          {t("crm.quick.uploadFailed", { files: uploadFailed.join(", ") })}
        </p>
        <div className="mt-3 flex justify-end">
          <Button type="button" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open titleId={titleId} title={t("crm.quick.title")} onClose={onClose} pending={pending} widthClassName="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <CrmAccountPicker id="crm-quick-account" label={t("crm.quick.account")} value={account} onChange={(v) => {
          setAccount(v);
          setContact("");
        }} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="crm-quick-kind" className={crmLabelClass}>
              {t("crm.quick.kind")}
            </label>
            <select id="crm-quick-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={crmInputClass}>
              {CRM_ACTIVITY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(CRM_ACTIVITY_KIND_LABELS[k])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="crm-quick-contact" className={crmLabelClass}>
              {t("crm.quick.contact")}
            </label>
            <select
              id="crm-quick-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value ? Number(e.target.value) : "")}
              className={crmInputClass}
              disabled={!account}
            >
              <option value="">{t("crm.common.none")}</option>
              {contacts.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${c.first_name} ${c.last_name ?? ""}`.trim()}
                  {c.position ? ` · ${c.position}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="crm-quick-result" className={crmLabelClass}>
              {t("crm.quick.result")}
            </label>
            <select id="crm-quick-result" value={result} onChange={(e) => setResult(e.target.value)} className={crmInputClass}>
              <option value="">{t("crm.common.none")}</option>
              {CRM_RESULTS.map((r) => (
                <option key={r} value={r}>
                  {t(CRM_RESULT_LABELS[r])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="crm-quick-interest" className={crmLabelClass}>
              {t("crm.quick.interest")}
            </label>
            <select id="crm-quick-interest" value={interest} onChange={(e) => setInterest(e.target.value)} className={crmInputClass}>
              <option value="">{t("crm.quick.interestUnchanged")}</option>
              {CRM_INTERESTS.map((i) => (
                <option key={i} value={i}>
                  {t(CRM_INTEREST_LABELS[i])}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="crm-quick-summary" className="text-sm font-medium text-text-form">
              {t("crm.quick.summary")}
            </label>
            {Recognition ? (
              <Button type="button" variant="secondary" onClick={toggleDictation} aria-pressed={listening}>
                {listening ? t("crm.quick.stopDictation") : t("crm.quick.dictate")}
              </Button>
            ) : null}
          </div>
          <textarea
            id="crm-quick-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className={crmInputClass}
          />
        </div>
        <div>
          <label htmlFor="crm-quick-files" className={crmLabelClass}>
            {t("crm.quick.attachments")}
          </label>
          <input
            id="crm-quick-files"
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
        </div>

        <fieldset className="rounded-md border border-border p-2">
          <legend className="px-1 text-sm font-medium text-text-base">{t("crm.quick.nextStep")}</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="crm-follow" checked={followUp} onChange={() => setFollowUp(true)} />
              {t("crm.quick.createFollowUp")}
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="crm-follow" checked={!followUp} onChange={() => setFollowUp(false)} />
              {t("crm.quick.noFollowUp")}
            </label>
          </div>
          {followUp ? (
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="crm-follow-kind" className={crmLabelClass}>
                  {t("crm.quick.followKind")}
                </label>
                <select id="crm-follow-kind" value={followKind} onChange={(e) => setFollowKind(e.target.value)} className={crmInputClass}>
                  {CRM_ACTIVITY_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(CRM_ACTIVITY_KIND_LABELS[k])}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="crm-follow-at" className={crmLabelClass}>
                  {t("crm.quick.followAt")}
                </label>
                <input id="crm-follow-at" type="datetime-local" value={followAt} onChange={(e) => setFollowAt(e.target.value)} className={crmInputClass} required />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="crm-follow-title" className={crmLabelClass}>
                  {t("crm.quick.followTitle")}
                </label>
                <input id="crm-follow-title" value={followTitle} onChange={(e) => setFollowTitle(e.target.value)} className={crmInputClass} />
              </div>
              <div>
                <label htmlFor="crm-follow-priority" className={crmLabelClass}>
                  {t("crm.quick.followPriority")}
                </label>
                <select id="crm-follow-priority" value={followPriority} onChange={(e) => setFollowPriority(e.target.value)} className={crmInputClass}>
                  {CRM_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t(CRM_PRIORITY_LABELS[p])}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="crm-follow-reminder" className={crmLabelClass}>
                  {t("crm.quick.reminder")}
                </label>
                <select id="crm-follow-reminder" value={reminder} onChange={(e) => setReminder(Number(e.target.value))} className={crmInputClass}>
                  {REMINDERS.map((m) => (
                    <option key={m} value={m}>
                      {t(CRM_REMINDER_LABELS[m])}
                    </option>
                  ))}
                </select>
              </div>
              {isManager ? (
                <div className="sm:col-span-2">
                  <CrmUserSelect id="crm-follow-assignee" label={t("crm.quick.assignee")} value={followAssignee} onChange={setFollowAssignee} />
                </div>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        {create.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(create.error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!account || pending}>
            {pending ? t("crm.common.saving") : t("crm.common.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
