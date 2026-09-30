"use client";

/**
 * Selector con búsqueda para elegir una cuenta, persona o entidad por su
 * nombre en vez de teclear su id interno (informe del panel, error 41).
 * Es solo la parte visual: quien lo usa (`AccountPicker`, `PersonPicker`,
 * `OrganizationPicker`) es dueño de la consulta y le pasa `options`.
 * Con una opción elegida enseña su nombre y un botón «Cambiar».
 */
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";

export interface PickerOption {
  id: number;
  label: string;
}

export interface SearchPickerProps {
  id: string;
  label: string;
  value: PickerOption | null;
  onChange: (option: PickerOption | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  options: PickerOption[] | undefined;
  loading?: boolean;
  error?: boolean;
  /** Texto del error de búsqueda; por defecto el genérico de `common.picker.error`. */
  errorText?: string;
  /** Caracteres mínimos para que `options` tenga sentido (por defecto 0). */
  minChars?: number;
}

export function SearchPicker({
  id,
  label,
  value,
  onChange,
  query,
  onQueryChange,
  options,
  loading = false,
  error = false,
  errorText,
  minChars = 0,
}: SearchPickerProps) {
  const t = useTranslations("common.picker");
  const tooShort = query.trim().length < minChars;
  const labelClass = "mb-1 block text-sm font-medium text-text-form";

  if (value) {
    return (
      <div>
        <span id={`${id}-label`} className={labelClass}>
          {label}
        </span>
        <div className="flex items-center gap-2 text-sm" aria-labelledby={`${id}-label`} role="group">
          <span className="rounded-md border border-border bg-border-light px-3 py-1.5">{value.label}</span>
          <Button type="button" variant="secondary" onClick={() => onChange(null)}>
            {t("change")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t("placeholder")}
        autoComplete="off"
        className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
      />
      {tooShort ? (
        <p className="mt-1 text-xs text-text-secondary">{t("minChars", { count: minChars })}</p>
      ) : error ? (
        <p role="alert" className="mt-1 text-xs text-error">
          {errorText ?? t("error")}
        </p>
      ) : loading || !options ? (
        <p className="mt-1 text-xs text-text-secondary">{t("loading")}</p>
      ) : options.length === 0 ? (
        <p className="mt-1 text-xs text-text-secondary">{t("empty")}</p>
      ) : (
        <ul
          aria-label={label}
          className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2 text-sm"
        >
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="text-left text-primary-700 underline"
                onClick={() => {
                  onChange(option);
                  onQueryChange("");
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
