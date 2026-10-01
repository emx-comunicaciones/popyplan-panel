"use client";

/**
 * Piezas comunes de las pantallas de entidades y contactos del CRM:
 * error de mutación, selector de municipio, etiquetas como texto y el
 * aviso de duplicados.
 */
import Link from "next/link";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { SearchPicker, type PickerOption } from "@/components/ui/SearchPicker";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { CrmError } from "@/hooks/useCrm";
import { useSearchPlaces } from "@/hooks/usePlaces";
import type { CrmContact, CrmDuplicate, CrmTag } from "@/lib/api/crmTypes";
import { crmAccountHref } from "@/lib/crm/nav";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { CRM_ERROR_KEYS } from "../QuickActivityDialog";

/** Texto del error de una mutación, `role="alert"`, para pintarlo dentro del diálogo. */
export function MutationError({ error }: { error: CrmError | null | undefined }) {
  const t = useTranslations();
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-error">
      {errorKindText(error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
    </p>
  );
}

export function contactFullName(contact: Pick<CrmContact, "first_name" | "last_name">): string {
  return `${contact.first_name} ${contact.last_name ?? ""}`.trim();
}

export const tagsToText = (tags: CrmTag[] | undefined): string => (tags ?? []).map((tag) => tag.name).join(", ");

export function textToTags(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(",")) {
    const name = part.trim();
    if (name) seen.add(name);
  }
  return Array.from(seen);
}

export interface PlaceChoice {
  ine: string;
  label: string;
}

/** Buscador de municipio del catálogo (INE): el código se guarda, el nombre se enseña. */
export function PlacePicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: PlaceChoice | null;
  onChange: (place: PlaceChoice | null) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const places = useSearchPlaces(debounced);
  const rows = places.data ?? [];
  const options: PickerOption[] | undefined = debounced.trim().length >= 2
    ? rows.map((place, index) => ({ id: index, label: `${place.name} · ${place.prov_name}` }))
    : undefined;
  return (
    <SearchPicker
      id={id}
      label={label}
      value={value ? { id: 0, label: value.label } : null}
      onChange={(option) => {
        if (!option) return onChange(null);
        const place = rows[option.id];
        if (place) onChange({ ine: place.ine_code, label: `${place.name} · ${place.prov_name}` });
      }}
      query={query}
      onQueryChange={setQuery}
      options={options}
      loading={places.isLoading && debounced.trim().length >= 2}
      error={places.isError}
      minChars={2}
    />
  );
}

/** Posibles duplicados con enlace a la ficha existente. */
export function DuplicatesList({ duplicates, live = false }: { duplicates: CrmDuplicate[]; live?: boolean }) {
  const t = useTranslations("crm.accounts.duplicates");
  if (!duplicates.length) return null;
  return (
    <div role={live ? "status" : undefined} className="rounded-md border border-secondary-600 bg-secondary-100 p-2 text-sm">
      <p className="font-medium text-text-base">{live ? t("liveTitle") : t("title")}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {duplicates.map((dup) => {
          const target = dup.account ?? dup.id;
          return (
            <li key={`${target}-${dup.name}`} className="flex flex-wrap items-center gap-x-2">
              <span>{dup.name}</span>
              {dup.municipality || dup.account_name ? <span className="text-text-secondary">{dup.municipality || dup.account_name}</span> : null}
              {dup.owner_name ? <span className="text-text-secondary">{t("owner", { name: dup.owner_name })}</span> : null}
              <Link href={crmAccountHref(target)} className="font-medium text-primary-700 underline">
                {t("open")}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** `tel:` / `mailto:` solo si hay valor. */
export function PhoneLink({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-text-secondary">—</span>;
  return (
    <a href={`tel:${value.replace(/\s+/g, "")}`} className="text-primary-700 underline">
      {value}
    </a>
  );
}

export function EmailLink({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-text-secondary">—</span>;
  return (
    <a href={`mailto:${value}`} className="break-all text-primary-700 underline">
      {value}
    </a>
  );
}

/** Texto de «hace N días» (o «sin contacto» si nunca hubo). */
export function DaysAgoText({ days, never }: { days: number | null; never?: string }) {
  const t = useTranslations("crm.accounts");
  if (days === null) return <span className="text-text-secondary">{never ?? t("never")}</span>;
  return <span>{t("daysAgo", { count: days })}</span>;
}

/**
 * Diálogo de formulario del CRM: cierra solo cuando quien lo usa lo cierra
 * en el `onSuccess` de su mutación; el error se lee dentro (`role="alert"`).
 */
export function FormDialog({
  title,
  onClose,
  onSubmit,
  pending = false,
  error,
  localError,
  canSubmit = true,
  submitLabel,
  children,
  extraActions,
  widthClassName = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  pending?: boolean;
  error?: CrmError | null;
  localError?: string | null;
  canSubmit?: boolean;
  submitLabel: string;
  children: ReactNode;
  extraActions?: ReactNode;
  widthClassName?: string;
}) {
  const t = useTranslations();
  const titleId = useId();
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <Dialog open titleId={titleId} title={title} onClose={onClose} pending={pending} widthClassName={widthClassName}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {children}
        <MutationError error={error} />
        {localError ? (
          <p role="alert" className="text-sm text-error">
            {localError}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          {extraActions}
          <Button type="submit" disabled={!canSubmit || pending}>
            {pending ? t("crm.common.saving") : submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Estado de carga/error de una consulta; con datos, pinta `children(data)`. */
export function QueryBoundary<T>({
  query,
  children,
}: {
  query: { data?: T; isLoading: boolean; isError: boolean; error: CrmError | null; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  const t = useTranslations();
  if (query.isLoading) return <p className="text-sm text-text-secondary">{t("crm.common.loading")}</p>;
  if (query.isError || query.data === undefined) {
    return (
      <ErrorState
        title={t("crm.accountDetail.loadError")}
        description={errorKindText(query.error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
        action={
          <Button type="button" variant="secondary" onClick={() => query.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }
  return <>{children(query.data)}</>;
}

/**
 * El paginador de DRF responde 404 cuando la página pedida ya no existe
 * (se borra lo último de la página 2 y la lista encoge): sin esto la
 * lista se quedaba en el error de `QueryBoundary`, con el paginador
 * oculto y un «Reintentar» que pide la misma página. Vuelve a la
 * anterior; si tampoco existe, el error de esa consulta la baja otra.
 */
export function useBackOnMissingPage(
  query: { error: CrmError | null },
  page: number,
  setPage: (page: number) => void,
): void {
  const missing = page > 1 && query.error?.kind === "no_encontrado";
  useEffect(() => {
    if (missing) setPage(page - 1);
  }, [missing, page, setPage]);
}

/** Páginas necesarias para `count` filas de `size` en `size`. */
export const pageCount = (count: number, size: number): number => Math.max(1, Math.ceil(count / size));

/** Anterior/Siguiente de las listas de la ficha; sin más de una página no pinta nada. */
export function PageNav({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  const t = useTranslations("crm.accountDetail.pagination");
  if (pages <= 1 && page <= 1) return null;
  return (
    <nav aria-label={t("label")} className="flex items-center justify-between gap-2">
      <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t("previous")}
      </Button>
      <span className="text-sm text-text-secondary">{t("page", { page, pages })}</span>
      <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t("next")}
      </Button>
    </nav>
  );
}
