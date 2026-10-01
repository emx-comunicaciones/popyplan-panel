"use client";

/**
 * Listas configurables (punto 29): origen del contacto, departamento y
 * producto. Se añaden, se renombran, se reordenan por número y se
 * activan o desactivan (nunca se borran: hay datos que las usan).
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCrmCatalog, useSaveCatalogItem } from "@/hooks/useCrm";
import type { CrmCatalogItem, CrmCatalogKind } from "@/lib/api/crmTypes";
import { CRM_CATALOG_KIND_LABELS } from "@/lib/crm/labels";

import { crmInputClass, crmLabelClass } from "../common";
import { useCrmErrorText } from "../work/shared";

const KINDS = Object.keys(CRM_CATALOG_KIND_LABELS) as CrmCatalogKind[];
const small = "w-full rounded-md border border-border bg-white px-1.5 py-1 text-sm";

function CatalogRow({
  item,
  editing,
  pending,
  onEdit,
  onCancel,
  onSave,
  onToggle,
}: {
  item: CrmCatalogItem;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (name: string, order: number) => void;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const [name, setName] = useState(item.name);
  const [order, setOrder] = useState(String(item.order ?? 0));
  const cell = "px-2 py-1.5 align-middle";
  const inactive = item.is_active === false;
  const orderNumber = Number(order);
  const valid = name.trim() !== "" && order.trim() !== "" && Number.isInteger(orderNumber) && orderNumber >= 0;

  if (!editing) {
    return (
      <tr className="border-b border-border-light">
        <td className={cell}>{item.name}</td>
        <td className={cell}>{item.order}</td>
        <td className={cell}>{inactive ? t("crm.settings.catalog.inactive") : t("crm.settings.catalog.active")}</td>
        <td className={cell}>
          <div className="flex gap-1">
            <Button type="button" variant="secondary" onClick={onEdit} disabled={pending}>
              {t("crm.settings.edit")}
            </Button>
            <Button type="button" variant="secondary" onClick={onToggle} disabled={pending}>
              {inactive ? t("crm.settings.activate") : t("crm.settings.deactivate")}
            </Button>
          </div>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-border-light bg-border-light">
      <td className={cell}>
        <input
          aria-label={t("crm.settings.catalog.nameOf", { name: item.name })}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={small}
        />
      </td>
      <td className={cell}>
        <input
          type="number"
          min={0}
          aria-label={t("crm.settings.catalog.orderOf", { name: item.name })}
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          className={`${small} w-20`}
        />
      </td>
      <td className={cell}>{inactive ? t("crm.settings.catalog.inactive") : t("crm.settings.catalog.active")}</td>
      <td className={cell}>
        <div className="flex gap-1">
          <Button type="button" disabled={pending || !valid} onClick={() => onSave(name.trim(), orderNumber)}>
            {t("crm.common.save")}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function CatalogSection() {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const [kind, setKind] = useState<CrmCatalogKind>("source");
  const catalog = useCrmCatalog(kind);
  const save = useSaveCatalogItem();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [order, setOrder] = useState("");
  const items = [...(catalog.data ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name),
  );

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    const number = order.trim() === "" ? undefined : Number(order);
    if (!trimmed || (number !== undefined && (!Number.isInteger(number) || number < 0))) return;
    save.mutate(
      { kind, name: trimmed, ...(number === undefined ? {} : { order: number }) },
      {
        onSuccess: () => {
          setName("");
          setOrder("");
        },
      },
    );
  }

  return (
    <section aria-labelledby="crm-settings-catalog" className="flex flex-col gap-2">
      <h2 id="crm-settings-catalog" className="text-lg font-semibold text-text-base">
        {t("crm.settings.catalog.title")}
      </h2>
      <p className="text-sm text-text-secondary">{t("crm.settings.catalog.hint")}</p>
      <div role="group" aria-label={t("crm.settings.catalog.kindLabel")} className="flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <Button
            key={k}
            type="button"
            variant={kind === k ? "primary" : "secondary"}
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setEditingId(null);
              save.reset();
            }}
          >
            {t(CRM_CATALOG_KIND_LABELS[k])}
          </Button>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-border-light p-2">
        <div className="min-w-48 flex-1">
          <label htmlFor="crm-catalog-name" className={crmLabelClass}>
            {t("crm.settings.catalog.newName")}
          </label>
          <input id="crm-catalog-name" value={name} onChange={(e) => setName(e.target.value)} className={crmInputClass} />
        </div>
        <div className="w-24">
          <label htmlFor="crm-catalog-order" className={crmLabelClass}>
            {t("crm.settings.catalog.newOrder")}
          </label>
          <input
            id="crm-catalog-order"
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className={crmInputClass}
          />
        </div>
        <Button type="submit" disabled={!name.trim() || save.isPending}>
          {t("crm.settings.catalog.add")}
        </Button>
      </form>

      {save.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorText(save.error)}
        </p>
      ) : null}

      {catalog.isLoading ? (
        <p role="status" className="text-sm text-text-secondary">
          {t("crm.common.loading")}
        </p>
      ) : catalog.isError ? (
        <ErrorState title={t("crm.settings.loadError")} description={errorText(catalog.error)} />
      ) : items.length === 0 ? (
        <p className="text-sm text-text-secondary">{t("crm.settings.catalog.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("crm.settings.catalog.caption", { kind: t(CRM_CATALOG_KIND_LABELS[kind]) })}</caption>
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  {t("crm.settings.catalog.columns.name")}
                </th>
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  {t("crm.settings.catalog.columns.order")}
                </th>
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  {t("crm.settings.catalog.columns.status")}
                </th>
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  <span className="sr-only">{t("common.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <CatalogRow
                  key={`${item.id}-${editingId === item.id}`}
                  item={item}
                  editing={editingId === item.id}
                  pending={save.isPending}
                  onEdit={() => {
                    save.reset();
                    setEditingId(item.id);
                  }}
                  onCancel={() => {
                    save.reset();
                    setEditingId(null);
                  }}
                  onSave={(newName, newOrder) =>
                    save.mutate({ id: item.id, name: newName, order: newOrder }, { onSuccess: () => setEditingId(null) })
                  }
                  onToggle={() => save.mutate({ id: item.id, is_active: item.is_active === false })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
