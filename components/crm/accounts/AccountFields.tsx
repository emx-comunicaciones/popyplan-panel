"use client";

/**
 * Campos de una entidad del CRM, compartidos por el alta («Nueva
 * entidad») y la pestaña «Datos» de la ficha. El estado vive en quien lo
 * usa (`AccountDraft`); aquí solo se pinta y se traduce a la escritura.
 */
import { useTranslations } from "next-intl";

import { useCrmCatalog, useCrmStages, useCrmUsers } from "@/hooks/useCrm";
import type { CrmAccountDetail, CrmAccountKind, CrmAccountWrite, CrmInterest } from "@/lib/api/crmTypes";
import {
  CRM_ACCOUNT_KINDS,
  CRM_ACCOUNT_KIND_LABELS,
  CRM_INTERESTS,
  CRM_INTEREST_LABELS,
} from "@/lib/crm/labels";

import { CrmUserSelect, crmInputClass, crmLabelClass } from "../common";
import { PlacePicker, textToTags, tagsToText, type PlaceChoice } from "./shared";

export interface AccountDraft {
  name: string;
  short_name: string;
  kind: string;
  place: PlaceChoice | null;
  province_name: string;
  region_name: string;
  population: string;
  tax_id: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  postal_code: string;
  source: string;
  interest: string;
  stage: string;
  tags: string;
  owner: number | null;
  collaborators: number[];
  notes: string;
}

export const EMPTY_DRAFT: AccountDraft = {
  name: "",
  short_name: "",
  kind: "city_council",
  place: null,
  province_name: "",
  region_name: "",
  population: "",
  tax_id: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  postal_code: "",
  source: "",
  interest: "unrated",
  stage: "",
  tags: "",
  owner: null,
  collaborators: [],
  notes: "",
};

export function draftFromAccount(account: CrmAccountDetail): AccountDraft {
  return {
    name: account.name,
    short_name: account.short_name ?? "",
    kind: account.kind ?? "other",
    place: account.place
      ? { ine: account.place.ine_code, label: `${account.place.name} · ${account.place.prov_name}` }
      : null,
    province_name: account.province_name ?? "",
    region_name: account.region_name ?? "",
    population: account.population != null ? String(account.population) : "",
    tax_id: account.tax_id ?? "",
    phone: account.phone ?? "",
    email: account.email ?? "",
    website: account.website ?? "",
    address: account.address ?? "",
    postal_code: account.postal_code ?? "",
    source: account.source ? String(account.source.id) : "",
    interest: account.interest ?? "unrated",
    stage: account.stage ? String(account.stage.id) : "",
    tags: tagsToText(account.tags),
    owner: account.owner?.id ?? null,
    collaborators: account.collaborators.map((user) => user.id),
    notes: account.notes ?? "",
  };
}

/** `isManager` decide si se mandan responsable y colaboradores (solo dirección los asigna). */
export function draftToWrite(draft: AccountDraft, options: { isManager: boolean; edit?: boolean }): CrmAccountWrite {
  const population = draft.population.trim() === "" ? null : Number(draft.population);
  const write: CrmAccountWrite = {
    name: draft.name.trim(),
    short_name: draft.short_name.trim(),
    kind: draft.kind as CrmAccountKind,
    place: draft.place?.ine ?? null,
    province_name: draft.place ? "" : draft.province_name.trim(),
    region_name: draft.place ? "" : draft.region_name.trim(),
    population: population !== null && Number.isFinite(population) ? population : null,
    tax_id: draft.tax_id.trim(),
    phone: draft.phone.trim(),
    email: draft.email.trim(),
    website: draft.website.trim(),
    address: draft.address.trim(),
    postal_code: draft.postal_code.trim(),
    source: draft.source ? Number(draft.source) : null,
    interest: draft.interest as CrmInterest,
    tags: textToTags(draft.tags),
  };
  if (draft.stage) write.stage = Number(draft.stage);
  if (options.edit) write.notes = draft.notes;
  if (options.isManager) {
    if (options.edit || draft.owner !== null) write.owner = draft.owner;
    if (options.edit) write.collaborators = draft.collaborators;
  }
  return write;
}

export function AccountFields({
  idPrefix,
  draft,
  onChange,
  isManager,
  edit = false,
}: {
  idPrefix: string;
  draft: AccountDraft;
  onChange: (draft: AccountDraft) => void;
  isManager: boolean;
  edit?: boolean;
}) {
  const t = useTranslations("crm.accounts.fields");
  const tEnum = useTranslations();
  const stages = useCrmStages();
  const sources = useCrmCatalog("source");
  const users = useCrmUsers();
  const set = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]) => onChange({ ...draft, [key]: value });
  const text = (key: keyof AccountDraft, label: string, type = "text", required = false) => (
    <div>
      <label htmlFor={`${idPrefix}-${key}`} className={crmLabelClass}>
        {label}
      </label>
      <input
        id={`${idPrefix}-${key}`}
        type={type}
        value={draft[key] as string}
        required={required}
        onChange={(event) => set(key, event.target.value as never)}
        className={crmInputClass}
      />
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">{text("name", t("name"), "text", true)}</div>
      <div>
        <label htmlFor={`${idPrefix}-kind`} className={crmLabelClass}>
          {t("kind")}
        </label>
        <select id={`${idPrefix}-kind`} value={draft.kind} onChange={(e) => set("kind", e.target.value)} className={crmInputClass}>
          {CRM_ACCOUNT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {tEnum(CRM_ACCOUNT_KIND_LABELS[kind])}
            </option>
          ))}
        </select>
      </div>
      {text("short_name", t("shortName"))}
      <div className="sm:col-span-2">
        <PlacePicker id={`${idPrefix}-place`} label={t("place")} value={draft.place} onChange={(place) => set("place", place)} />
        {draft.place ? null : <p className="mt-1 text-xs text-text-secondary">{t("placeHint")}</p>}
      </div>
      {draft.place ? null : (
        <>
          {text("province_name", t("province"))}
          {text("region_name", t("region"))}
        </>
      )}
      {text("population", t("population"), "number")}
      {text("tax_id", t("taxId"))}
      {text("phone", t("phone"), "tel")}
      {text("email", t("email"), "email")}
      {text("website", t("website"), "url")}
      {text("postal_code", t("postalCode"))}
      <div className="sm:col-span-2">{text("address", t("address"))}</div>
      <div>
        <label htmlFor={`${idPrefix}-source`} className={crmLabelClass}>
          {t("source")}
        </label>
        <select id={`${idPrefix}-source`} value={draft.source} onChange={(e) => set("source", e.target.value)} className={crmInputClass}>
          <option value="">{tEnum("crm.common.none")}</option>
          {sources.data?.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-interest`} className={crmLabelClass}>
          {t("interest")}
        </label>
        <select id={`${idPrefix}-interest`} value={draft.interest} onChange={(e) => set("interest", e.target.value)} className={crmInputClass}>
          {CRM_INTERESTS.map((interest) => (
            <option key={interest} value={interest}>
              {tEnum(CRM_INTEREST_LABELS[interest])}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-stage`} className={crmLabelClass}>
          {t("stage")}
        </label>
        <select id={`${idPrefix}-stage`} value={draft.stage} onChange={(e) => set("stage", e.target.value)} className={crmInputClass}>
          {edit ? null : <option value="">{t("stageDefault")}</option>}
          {stages.data?.filter((stage) => stage.is_active || String(stage.id) === draft.stage).map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-tags`} className={crmLabelClass}>
          {t("tags")}
        </label>
        <input id={`${idPrefix}-tags`} value={draft.tags} onChange={(e) => set("tags", e.target.value)} className={crmInputClass} aria-describedby={`${idPrefix}-tags-hint`} />
        <p id={`${idPrefix}-tags-hint`} className="mt-1 text-xs text-text-secondary">
          {t("tagsHint")}
        </p>
      </div>
      {isManager ? (
        <div>
          <CrmUserSelect id={`${idPrefix}-owner`} label={t("owner")} value={draft.owner} onChange={(value) => set("owner", value)} allowEmpty />
        </div>
      ) : null}
      {isManager && edit ? (
        <fieldset className="sm:col-span-2">
          <legend className={crmLabelClass}>{t("collaborators")}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {users.data?.map((user) => (
              <label key={user.id} className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft.collaborators.includes(user.id)}
                  onChange={(event) =>
                    set(
                      "collaborators",
                      event.target.checked
                        ? [...draft.collaborators, user.id]
                        : draft.collaborators.filter((id) => id !== user.id),
                    )
                  }
                />
                {user.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {edit ? (
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-notes`} className={crmLabelClass}>
            {t("notes")}
          </label>
          <textarea id={`${idPrefix}-notes`} rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} className={crmInputClass} />
        </div>
      ) : null}
    </div>
  );
}
