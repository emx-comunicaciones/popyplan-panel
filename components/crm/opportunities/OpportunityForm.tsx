"use client";

/**
 * Edición de una oportunidad, agrupada en «General» y «Contratación
 * pública». Un solo `PATCH` con todos los campos del formulario. Se monta
 * con `key` por oportunidad y versión (sin ella, tras refrescar se
 * quedaría con datos viejos).
 */
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useCrmAccountContacts, useCrmCatalog, useUpdateOpportunity } from "@/hooks/useCrm";
import type { CrmOpportunity } from "@/lib/api/crmTypes";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { CRM_INTERESTS, CRM_INTEREST_LABELS } from "@/lib/crm/labels";

import { CrmUserSelect, crmInputClass, crmLabelClass } from "../common";
import { CRM_ERROR_KEYS } from "../QuickActivityDialog";

const TEXT_FIELDS = {
  name: "crm.opportunityDetail.fields.name",
  description: "crm.opportunityDetail.fields.description",
  notes: "crm.opportunityDetail.fields.notes",
  budget_line: "crm.opportunityDetail.fields.budgetLine",
  funding: "crm.opportunityDetail.fields.funding",
  file_number: "crm.opportunityDetail.fields.fileNumber",
  file_url: "crm.opportunityDetail.fields.fileUrl",
  procedure_notes: "crm.opportunityDetail.fields.procedureNotes",
  procurement_manager: "crm.opportunityDetail.fields.procurementManager",
  required_documents: "crm.opportunityDetail.fields.requiredDocuments",
  procurement_notes: "crm.opportunityDetail.fields.procurementNotes",
  estimated_amount: "crm.opportunityDetail.fields.estimatedAmount",
  available_budget: "crm.opportunityDetail.fields.availableBudget",
  contract_duration_months: "crm.opportunityDetail.fields.durationMonths",
  associations_count: "crm.opportunityDetail.fields.associations",
  users_count: "crm.opportunityDetail.fields.users",
  professionals_count: "crm.opportunityDetail.fields.professionals",
  expected_close_date: "crm.opportunityDetail.fields.expectedClose",
  tender_date: "crm.opportunityDetail.fields.tenderDate",
  deadline: "crm.opportunityDetail.fields.deadline",
} as const;

type TextField = keyof typeof TEXT_FIELDS;

const DECIMALS: TextField[] = ["estimated_amount", "available_budget"];
const INTEGERS: TextField[] = ["contract_duration_months", "associations_count", "users_count", "professionals_count"];
const DATES: TextField[] = ["expected_close_date", "tender_date", "deadline"];
const STRINGS: TextField[] = [
  "name",
  "description",
  "notes",
  "budget_line",
  "funding",
  "file_number",
  "file_url",
  "procedure_notes",
  "procurement_manager",
  "required_documents",
  "procurement_notes",
];

const FUNDING_FLAGS = [
  { name: "has_subsidy", key: "crm.opportunityDetail.fields.hasSubsidy" },
  { name: "eu_funds", key: "crm.opportunityDetail.fields.euFunds" },
  { name: "regional_funds", key: "crm.opportunityDetail.fields.regionalFunds" },
  { name: "state_funds", key: "crm.opportunityDetail.fields.stateFunds" },
] as const;

type FlagName = (typeof FUNDING_FLAGS)[number]["name"];

function initialText(opportunity: CrmOpportunity): Record<TextField, string> {
  const out = {} as Record<TextField, string>;
  for (const field of Object.keys(TEXT_FIELDS) as TextField[]) {
    const value = opportunity[field];
    out[field] = value === null || value === undefined ? "" : String(value);
  }
  return out;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-semibold text-text-base">{title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function OpportunityForm({ opportunity, isManager }: { opportunity: CrmOpportunity; isManager: boolean }) {
  const t = useTranslations();
  const uid = useId();
  const update = useUpdateOpportunity();
  const products = useCrmCatalog("product");
  const contacts = useCrmAccountContacts(opportunity.account ?? null);
  const [text, setText] = useState(() => initialText(opportunity));
  const [product, setProduct] = useState(opportunity.product ? String(opportunity.product) : "");
  const [interest, setInterest] = useState<string>(opportunity.interest ?? "unrated");
  const [owner, setOwner] = useState<number | null>(opportunity.owner ?? null);
  const [technical, setTechnical] = useState(opportunity.technical_contact ? String(opportunity.technical_contact) : "");
  const [administrative, setAdministrative] = useState(
    opportunity.administrative_contact ? String(opportunity.administrative_contact) : "",
  );
  const [flags, setFlags] = useState<Record<FlagName, boolean>>({
    has_subsidy: !!opportunity.has_subsidy,
    eu_funds: !!opportunity.eu_funds,
    regional_funds: !!opportunity.regional_funds,
    state_funds: !!opportunity.state_funds,
  });
  const [saved, setSaved] = useState(false);

  const id = (name: string) => `${uid}-${name}`;
  const set = (field: TextField, value: string) => {
    setSaved(false);
    setText((current) => ({ ...current, [field]: value }));
  };

  function input(field: TextField, kind: "text" | "date" | "number" | "url" = "text") {
    return (
      <div key={field}>
        <label htmlFor={id(field)} className={crmLabelClass}>
          {t(TEXT_FIELDS[field])}
        </label>
        <input
          id={id(field)}
          type={kind}
          value={text[field]}
          min={kind === "number" ? 0 : undefined}
          step={kind === "number" ? (DECIMALS.includes(field) ? "0.01" : "1") : undefined}
          onChange={(e) => set(field, e.target.value)}
          className={crmInputClass}
          required={field === "name"}
        />
      </div>
    );
  }

  function area(field: TextField, describedBy?: string) {
    return (
      <div key={field} className="sm:col-span-2">
        <label htmlFor={id(field)} className={crmLabelClass}>
          {t(TEXT_FIELDS[field])}
        </label>
        <textarea
          id={id(field)}
          value={text[field]}
          aria-describedby={describedBy}
          onChange={(e) => set(field, e.target.value)}
          rows={3}
          className={crmInputClass}
        />
      </div>
    );
  }

  function contactSelect(name: string, labelKey: string, value: string, onChange: (value: string) => void) {
    return (
      <div>
        <label htmlFor={id(name)} className={crmLabelClass}>
          {t(labelKey)}
        </label>
        <select
          id={id(name)}
          value={value}
          onChange={(e) => {
            setSaved(false);
            onChange(e.target.value);
          }}
          className={crmInputClass}
        >
          <option value="">{t("crm.common.none")}</option>
          {contacts.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {`${c.first_name} ${c.last_name ?? ""}`.trim()}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const field of STRINGS) payload[field] = text[field].trim();
    for (const field of DECIMALS) payload[field] = text[field] === "" ? null : text[field];
    for (const field of INTEGERS) payload[field] = text[field] === "" ? null : Number(text[field]);
    for (const field of DATES) payload[field] = text[field] === "" ? null : text[field];
    Object.assign(payload, flags);
    payload.product = product ? Number(product) : null;
    payload.interest = interest;
    payload.technical_contact = technical ? Number(technical) : null;
    payload.administrative_contact = administrative ? Number(administrative) : null;
    if (isManager && owner) payload.owner = owner;
    setSaved(false);
    update.mutate({ id: opportunity.id, ...payload }, { onSuccess: () => setSaved(true) });
  }

  const noteId = id("procedure-note");

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label={t("crm.opportunityDetail.formLabel")}>
      <Group title={t("crm.opportunityDetail.groups.general")}>
        {input("name")}
        <div>
          <label htmlFor={id("product")} className={crmLabelClass}>
            {t("crm.opportunityDetail.fields.product")}
          </label>
          <select id={id("product")} value={product} onChange={(e) => { setSaved(false); setProduct(e.target.value); }} className={crmInputClass}>
            <option value="">{t("crm.common.none")}</option>
            {products.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {area("description")}
        <div>
          <label htmlFor={id("interest")} className={crmLabelClass}>
            {t("crm.opportunityDetail.fields.interest")}
          </label>
          <select id={id("interest")} value={interest} onChange={(e) => { setSaved(false); setInterest(e.target.value); }} className={crmInputClass}>
            {CRM_INTERESTS.map((value) => (
              <option key={value} value={value}>
                {t(CRM_INTEREST_LABELS[value])}
              </option>
            ))}
          </select>
        </div>
        {input("estimated_amount", "number")}
        {input("expected_close_date", "date")}
        {input("contract_duration_months", "number")}
        {input("associations_count", "number")}
        {input("users_count", "number")}
        {input("professionals_count", "number")}
        {isManager ? (
          <CrmUserSelect id={id("owner")} label={t("crm.opportunityDetail.fields.owner")} value={owner} onChange={(value) => { setSaved(false); setOwner(value); }} />
        ) : null}
        {area("notes")}
      </Group>

      <Group title={t("crm.opportunityDetail.groups.procurement")}>
        {input("available_budget", "number")}
        {input("budget_line")}
        {area("funding")}
        <div className="flex flex-wrap gap-4 text-sm sm:col-span-2">
          {FUNDING_FLAGS.map((flag) => (
            <label key={flag.name} className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={flags[flag.name]}
                onChange={(e) => {
                  setSaved(false);
                  setFlags((current) => ({ ...current, [flag.name]: e.target.checked }));
                }}
              />
              {t(flag.key)}
            </label>
          ))}
        </div>
        {input("file_number")}
        {input("file_url", "url")}
        <p id={noteId} className="rounded-md bg-border-light p-2 text-xs text-text-secondary sm:col-span-2">
          {t("crm.opportunityDetail.procedureNote")}
        </p>
        {area("procedure_notes", noteId)}
        {input("tender_date", "date")}
        {input("deadline", "date")}
        {input("procurement_manager")}
        <div className="hidden sm:block" aria-hidden="true" />
        {contactSelect("technical", "crm.opportunityDetail.fields.technicalContact", technical, setTechnical)}
        {contactSelect("administrative", "crm.opportunityDetail.fields.administrativeContact", administrative, setAdministrative)}
        {area("required_documents")}
        {area("procurement_notes")}
      </Group>

      {update.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(update.error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          {t("crm.opportunityDetail.saved")}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? t("crm.common.saving") : t("crm.common.save")}
        </Button>
      </div>
    </form>
  );
}
