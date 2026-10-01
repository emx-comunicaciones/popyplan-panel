"use client";

/**
 * Umbrales (punto 31): días de «Necesitan atención», sin actividad en una
 * oportunidad, sin respuesta a una propuesta, aviso de fecha de
 * contratación y avisos de renovación. Se validan los enteros en el
 * cliente y los errores de campo del backend salen junto a su campo.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCrmSettings, useSaveSettings } from "@/hooks/useCrm";
import type { CrmSettings } from "@/lib/api/crmTypes";

import { crmInputClass, crmLabelClass } from "../common";
import { useCrmErrorText } from "../work/shared";

type Field =
  | "attention_days"
  | "opportunity_idle_days"
  | "proposal_followup_days"
  | "close_date_warning_days"
  | "renewal_alert_days";

const LIST_FIELDS: Field[] = ["attention_days", "renewal_alert_days"];

const FIELDS: { name: Field; label: string; hint: string }[] = [
  { name: "attention_days", label: "crm.settings.thresholds.attentionDays", hint: "crm.settings.thresholds.attentionDaysHint" },
  { name: "opportunity_idle_days", label: "crm.settings.thresholds.opportunityIdleDays", hint: "crm.settings.thresholds.opportunityIdleDaysHint" },
  { name: "proposal_followup_days", label: "crm.settings.thresholds.proposalFollowupDays", hint: "crm.settings.thresholds.proposalFollowupDaysHint" },
  { name: "close_date_warning_days", label: "crm.settings.thresholds.closeDateWarningDays", hint: "crm.settings.thresholds.closeDateWarningDaysHint" },
  { name: "renewal_alert_days", label: "crm.settings.thresholds.renewalAlertDays", hint: "crm.settings.thresholds.renewalAlertDaysHint" },
];

/** `"7, 15,30"` → `[7, 15, 30]`; `null` si algún trozo no es un entero positivo. */
export function parseIntList(text: string): number[] | null {
  const parts = text.split(",").map((p) => p.trim());
  if (parts.length === 0 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const numbers = parts.map(Number);
  return numbers.every((n) => n > 0) ? numbers : null;
}

function parseInt1(text: string): number | null {
  return /^\d+$/.test(text.trim()) && Number(text) > 0 ? Number(text) : null;
}

function ThresholdsForm({ settings }: { settings: CrmSettings }) {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const save = useSaveSettings();
  const [values, setValues] = useState<Record<Field, string>>({
    attention_days: settings.attention_days.join(", "),
    opportunity_idle_days: String(settings.opportunity_idle_days ?? ""),
    proposal_followup_days: String(settings.proposal_followup_days ?? ""),
    close_date_warning_days: String(settings.close_date_warning_days ?? ""),
    renewal_alert_days: settings.renewal_alert_days.join(", "),
  });
  const [invalid, setInvalid] = useState<Field[]>([]);
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const bad: Field[] = [];
    const parsed: Partial<Record<Field, number | number[]>> = {};
    for (const { name } of FIELDS) {
      const value = LIST_FIELDS.includes(name) ? parseIntList(values[name]) : parseInt1(values[name]);
      if (value === null) bad.push(name);
      else parsed[name] = value;
    }
    setInvalid(bad);
    if (bad.length) return;
    save.mutate(parsed as unknown as CrmSettings, { onSuccess: () => setSaved(true) });
  }

  const serverFields = save.error?.fields ?? {};

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3">
      {FIELDS.map(({ name, label, hint }) => {
        const id = `crm-threshold-${name}`;
        const clientError = invalid.includes(name);
        const serverError = serverFields[name];
        return (
          <div key={name}>
            <label htmlFor={id} className={crmLabelClass}>
              {t(label)}
            </label>
            <input
              id={id}
              value={values[name]}
              inputMode={LIST_FIELDS.includes(name) ? "text" : "numeric"}
              onChange={(e) => {
                setSaved(false);
                setValues((v) => ({ ...v, [name]: e.target.value }));
              }}
              aria-invalid={clientError || !!serverError}
              aria-describedby={`${id}-hint`}
              className={crmInputClass}
            />
            <p id={`${id}-hint`} className="mt-1 text-xs text-text-secondary">
              {t(hint)}
            </p>
            {clientError ? (
              <p role="alert" className="mt-1 text-xs text-error">
                {t(LIST_FIELDS.includes(name) ? "crm.settings.thresholds.listInvalid" : "crm.settings.thresholds.numberInvalid")}
              </p>
            ) : null}
            {serverError ? (
              <p role="alert" className="mt-1 text-xs text-error">
                {serverError}
              </p>
            ) : null}
          </div>
        );
      })}
      {save.isError && !save.error.fields ? (
        <p role="alert" className="text-sm text-error">
          {errorText(save.error)}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          {t("crm.settings.thresholds.saved")}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t("crm.common.saving") : t("crm.common.save")}
        </Button>
      </div>
    </form>
  );
}

export function ThresholdsSection() {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const settings = useCrmSettings();
  return (
    <section aria-labelledby="crm-settings-thresholds" className="flex flex-col gap-2">
      <h2 id="crm-settings-thresholds" className="text-lg font-semibold text-text-base">
        {t("crm.settings.thresholds.title")}
      </h2>
      <p className="text-sm text-text-secondary">{t("crm.settings.thresholds.hint")}</p>
      {settings.isLoading ? (
        <p role="status" className="text-sm text-text-secondary">
          {t("crm.common.loading")}
        </p>
      ) : settings.isError || !settings.data ? (
        <ErrorState title={t("crm.settings.loadError")} description={errorText(settings.error)} />
      ) : (
        <ThresholdsForm settings={settings.data} />
      )}
    </section>
  );
}
