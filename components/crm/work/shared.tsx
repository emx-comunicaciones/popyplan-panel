"use client";

/**
 * Piezas comunes de las pantallas de trabajo del CRM (actividades, tareas,
 * calendario, documentos): paginador, selector de personas para filtrar y
 * texto de error de una mutación.
 */
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useCrmUsers, type CrmError } from "@/hooks/useCrm";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { CRM_ERROR_KEYS } from "../QuickActivityDialog";
import { crmInputClass, crmLabelClass } from "../common";

export const CRM_PAGE_SIZE = 25;
export const CRM_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Recordatorios disponibles (minutos antes), en el orden del desplegable. */
export { CRM_REMINDERS as CRM_REMINDER_MINUTES } from "../QuickActivityDialog";

/** Texto de error de una mutación o consulta del CRM (el `detail` del backend manda). */
export function useCrmErrorText(): (error: CrmError | null | undefined) => string {
  const t = useTranslations();
  return (error) => errorKindText(error, CRM_ERROR_KEYS, t, "errors.crm.desconocido");
}

export interface PagerLabels {
  previous: string;
  next: string;
  summary: string;
}

/** Paginador anterior/siguiente; no pinta nada si cabe en una página. */
export function Pager({
  page,
  count,
  onPage,
  labels,
}: {
  page: number;
  count: number;
  onPage: (page: number) => void;
  labels: PagerLabels;
}) {
  const pages = Math.max(1, Math.ceil(count / CRM_PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="mt-2 flex items-center justify-end gap-2 text-sm text-text-secondary">
      <span>{labels.summary}</span>
      <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {labels.previous}
      </Button>
      <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {labels.next}
      </Button>
    </div>
  );
}

/** `<select>` de comerciales para un filtro (con una opción «todos»). */
export function CrmUserFilter({
  id,
  label,
  allLabel,
  value,
  onChange,
}: {
  id: string;
  label: string;
  allLabel: string;
  value: number | "";
  onChange: (value: number | "") => void;
}) {
  const users = useCrmUsers();
  return (
    <div>
      <label htmlFor={id} className={crmLabelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : "")}
        className={`${crmInputClass} sm:w-auto`}
      >
        <option value="">{allLabel}</option>
        {users.data?.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export const crmFilterInputClass = `${crmInputClass} sm:w-auto`;
