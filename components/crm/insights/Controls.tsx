"use client";

/**
 * Controles compartidos por dashboard, informes, mapa y «Necesitan
 * atención»: selector de periodo (botones con `aria-pressed`, sin ARIA
 * tabs) y barra de filtros comunes.
 */
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { useCrmCatalog, useCrmCoverage, useCrmStages, useCrmUsers } from "@/hooks/useCrm";
import { CRM_ACCOUNT_KINDS, CRM_ACCOUNT_KIND_LABELS, CRM_INTERESTS, CRM_INTEREST_LABELS, crmLabel } from "@/lib/crm/labels";

import { crmInputClass, crmLabelClass } from "../common";
import { CRM_PERIODS, type CrmPeriod, type FilterValues, type PeriodState } from "./filters";

const PERIOD_LABELS: Record<CrmPeriod, string> = {
  today: "crm.period.today",
  week: "crm.period.week",
  month: "crm.period.month",
  quarter: "crm.period.quarter",
  year: "crm.period.year",
  custom: "crm.period.custom",
};

export function PeriodControls({
  value,
  onChange,
  invalid,
}: {
  value: PeriodState;
  onChange: (next: PeriodState) => void;
  invalid: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={t("crm.period.label")} className="flex flex-wrap items-center gap-1.5">
        {CRM_PERIODS.map((period) => {
          const active = value.period === period;
          return (
            <button
              key={period}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...value, period })}
              className={`min-h-8 rounded-md border px-3 py-1 text-sm font-medium ${
                active
                  ? "border-primary-700 bg-primary-700 text-text-inverse"
                  : "border-border bg-white text-text-form hover:bg-border-light"
              }`}
            >
              {t(PERIOD_LABELS[period])}
            </button>
          );
        })}
      </div>
      {value.period === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="crm-period-since" className={crmLabelClass}>
              {t("crm.period.since")}
            </label>
            <input
              id="crm-period-since"
              type="date"
              value={value.since}
              max={value.until || undefined}
              onChange={(event) => onChange({ ...value, since: event.target.value })}
              className={crmInputClass}
            />
          </div>
          <div>
            <label htmlFor="crm-period-until" className={crmLabelClass}>
              {t("crm.period.until")}
            </label>
            <input
              id="crm-period-until"
              type="date"
              value={value.until}
              min={value.since || undefined}
              onChange={(event) => onChange({ ...value, until: event.target.value })}
              className={crmInputClass}
            />
          </div>
        </div>
      ) : null}
      {invalid ? (
        <p role="alert" className="text-sm text-error">
          {t("crm.period.invalid")}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  const t = useTranslations("crm.period.filters");
  return (
    <div>
      <label htmlFor={id} className={crmLabelClass}>
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={crmInputClass}>
        <option value="">{t("all")}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Comunidades y provincias con entidades registradas (de la cobertura), para los filtros. */
export function useTerritoryOptions() {
  const regions = useCrmCoverage({ level: "region" });
  const provinces = useCrmCoverage({ level: "province" });
  const toOptions = (rows: { name: string }[] | undefined): SelectOption[] =>
    (rows ?? []).filter((row) => row.name && row.name !== "—").map((row) => ({ value: row.name, label: row.name }));
  return {
    regions: toOptions(regions.data),
    provinces: toOptions(provinces.data),
    isError: regions.isError || provinces.isError,
  };
}

export type FilterField = "owner" | "region" | "province" | "kind" | "product" | "stage" | "interest";

export function FilterBar({
  values,
  onChange,
  fields,
  isManager,
  extra,
}: {
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  fields: FilterField[];
  isManager: boolean;
  /** Filtros propios de una pantalla, tras los comunes. */
  extra?: ReactNode;
}) {
  const t = useTranslations();
  const users = useCrmUsers();
  const stages = useCrmStages();
  const products = useCrmCatalog("product");
  const territory = useTerritoryOptions();
  const set = <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => onChange({ ...values, [key]: value });
  const has = (field: FilterField) => fields.includes(field) && (field !== "owner" || isManager);
  const loadFailed = territory.isError || users.isError || stages.isError || products.isError;

  return (
    <fieldset className="rounded-lg border border-border bg-white p-3">
      <legend className="px-1 text-sm font-semibold text-text-secondary">{t("crm.period.filters.group")}</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {has("owner") ? (
          <FilterSelect
            id="crm-filter-owner"
            label={t("crm.period.filters.owner")}
            value={values.owner === null ? "" : String(values.owner)}
            onChange={(value) => set("owner", value ? Number(value) : null)}
            options={(users.data ?? []).map((user) => ({ value: String(user.id), label: user.name }))}
          />
        ) : null}
        {has("region") ? (
          <FilterSelect
            id="crm-filter-region"
            label={t("crm.period.filters.region")}
            value={values.region}
            onChange={(value) => set("region", value)}
            options={territory.regions}
          />
        ) : null}
        {has("province") ? (
          <FilterSelect
            id="crm-filter-province"
            label={t("crm.period.filters.province")}
            value={values.province}
            onChange={(value) => set("province", value)}
            options={territory.provinces}
          />
        ) : null}
        {has("kind") ? (
          <FilterSelect
            id="crm-filter-kind"
            label={t("crm.period.filters.kind")}
            value={values.kind}
            onChange={(value) => set("kind", value)}
            options={CRM_ACCOUNT_KINDS.map((kind) => ({
              value: kind,
              label: crmLabel(CRM_ACCOUNT_KIND_LABELS, kind, t),
            }))}
          />
        ) : null}
        {has("product") ? (
          <FilterSelect
            id="crm-filter-product"
            label={t("crm.period.filters.product")}
            value={values.product}
            onChange={(value) => set("product", value)}
            options={(products.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
          />
        ) : null}
        {has("stage") ? (
          <FilterSelect
            id="crm-filter-stage"
            label={t("crm.period.filters.stage")}
            value={values.stage}
            onChange={(value) => set("stage", value)}
            options={(stages.data ?? []).map((stage) => ({ value: String(stage.id), label: stage.name }))}
          />
        ) : null}
        {has("interest") ? (
          <FilterSelect
            id="crm-filter-interest"
            label={t("crm.period.filters.interest")}
            value={values.interest}
            onChange={(value) => set("interest", value)}
            options={CRM_INTERESTS.map((interest) => ({
              value: interest,
              label: crmLabel(CRM_INTEREST_LABELS, interest, t),
            }))}
          />
        ) : null}
        {extra}
      </div>
      {loadFailed ? (
        <p role="alert" className="mt-2 text-xs text-error">
          {t("crm.period.filters.optionsError")}
        </p>
      ) : null}
    </fieldset>
  );
}
