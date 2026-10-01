"use client";

/**
 * Piezas pequeñas compartidas por las pantallas del CRM.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { SearchPicker, type PickerOption } from "@/components/ui/SearchPicker";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCrmAccounts, useCrmUsers } from "@/hooks/useCrm";
import type { CrmStage } from "@/lib/api/crmTypes";
import { CRM_INTEREST_LABELS, crmLabel, interestLevel } from "@/lib/crm/labels";

/** Nivel de interés como cinco segmentos + texto (nunca solo color, punto 24). */
export function InterestMeter({ value }: { value: string | null | undefined }) {
  const t = useTranslations();
  const level = interestLevel(value);
  const text = crmLabel(CRM_INTEREST_LABELS, value ?? "unrated", t);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-base">
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`inline-block h-2.5 w-1.5 rounded-sm ${n <= level ? "bg-primary-700" : "bg-border"}`}
          />
        ))}
      </span>
      <span>{text}</span>
    </span>
  );
}

/** Fase comercial: color de la fase como punto + su nombre (nunca solo color). */
export function StageBadge({ stage }: { stage: Pick<CrmStage, "name" | "color"> | null | undefined }) {
  if (!stage) return <span className="text-sm text-text-secondary">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2 py-0.5 text-xs font-medium text-text-base">
      <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: stage.color || "#9AA5B1" }} />
      {stage.name}
    </span>
  );
}

/** Elegir una entidad del CRM por su nombre (solo las que ve quien busca). */
export function CrmAccountPicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: PickerOption | null;
  onChange: (option: PickerOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const accounts = useCrmAccounts(debounced.trim().length >= 2 ? { q: debounced, page_size: 10 } : undefined);
  const options =
    debounced.trim().length >= 2
      ? accounts.data?.results.map((a) => ({
          id: a.id,
          label: a.place ? `${a.name} · ${a.place.name}` : a.name,
        }))
      : undefined;
  return (
    <SearchPicker
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      options={options}
      loading={accounts.isLoading && debounced.trim().length >= 2}
      error={accounts.isError}
      minChars={2}
    />
  );
}

/** `<select>` de las personas con rol de CRM. */
export function CrmUserSelect({
  id,
  label,
  value,
  onChange,
  allowEmpty = false,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  allowEmpty?: boolean;
}) {
  const t = useTranslations("crm.common");
  const users = useCrmUsers();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-text-form">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
      >
        {allowEmpty ? <option value="">{t("nobody")}</option> : null}
        {users.data?.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
      {users.isError ? (
        <p role="alert" className="mt-1 text-xs text-error">
          {t("usersError")}
        </p>
      ) : null}
    </div>
  );
}

/** Clase común de los campos de formulario del CRM. */
export const crmInputClass = "w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm";
export const crmLabelClass = "mb-1 block text-sm font-medium text-text-form";
