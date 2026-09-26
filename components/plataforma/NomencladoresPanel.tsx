"use client";

/**
 * Nomencladores del admin de plataforma (bloque 3, 2026-09-26): un
 * `<select>` elige uno de los siete catálogos vivos del backend y debajo
 * se pinta su tabla, con alta/edición en un `Dialog` y borrado con
 * `ConfirmDialog` (error dentro, patrón M6-M10). Los campos de cada
 * catálogo salen de `hooks/useCatalogs.ts::CATALOG_CONFIG`, así que el
 * componente es uno solo para los siete.
 *
 * Borrar es real y a veces arrastra: una categoría de comunidad o de
 * actividad se lleva sus subcategorías y deja sin categoría a lo que la
 * usaba; una categoría de afición con aficiones no se deja borrar (llega
 * como error del servidor). El diálogo lo avisa y propone desactivar.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table, type TableColumn } from "@/components/ui/Table";
import {
  CATALOG_CONFIG,
  CATALOG_KEYS,
  EVENT_CATEGORY_TYPES,
  useCatalog,
  useDeleteCatalogItem,
  useSaveCatalogItem,
  type CatalogField,
  type CatalogFormValues,
  type CatalogItem,
  type CatalogKey,
  type CatalogsErrorKind,
} from "@/hooks/useCatalogs";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { DisciplinasCatalog } from "./nomencladores/DisciplinasCatalog";
import { EjerciciosCatalog } from "./nomencladores/EjerciciosCatalog";
import { PlantillasEntrenamientoCatalog } from "./nomencladores/PlantillasEntrenamientoCatalog";

const TRAINING_CATALOG_KEYS = ["trainingDisciplines", "trainingExercises", "trainingTemplates"] as const;
type TrainingCatalogKey = (typeof TRAINING_CATALOG_KEYS)[number];
type SelectorKey = CatalogKey | TrainingCatalogKey;

const TRAINING_CATALOG_LABEL_KEYS: Record<TrainingCatalogKey, string> = {
  trainingDisciplines: "plataforma.nomencladores.training.catalogs.disciplines",
  trainingExercises: "plataforma.nomencladores.training.catalogs.exercises",
  trainingTemplates: "plataforma.nomencladores.training.catalogs.templates",
};

function isTrainingCatalog(key: SelectorKey): key is TrainingCatalogKey {
  return (TRAINING_CATALOG_KEYS as readonly string[]).includes(key);
}

function TrainingCatalog({ catalog }: { catalog: TrainingCatalogKey }) {
  if (catalog === "trainingDisciplines") return <DisciplinasCatalog />;
  if (catalog === "trainingExercises") return <EjerciciosCatalog />;
  return <PlantillasEntrenamientoCatalog />;
}

const CATALOG_LABEL_KEYS: Record<CatalogKey, string> = {
  languages: "plataforma.nomencladores.catalogs.languages",
  hobbyCategories: "plataforma.nomencladores.catalogs.hobbyCategories",
  hobbies: "plataforma.nomencladores.catalogs.hobbies",
  communityCategories: "plataforma.nomencladores.catalogs.communityCategories",
  communitySubcategories: "plataforma.nomencladores.catalogs.communitySubcategories",
  eventCategories: "plataforma.nomencladores.catalogs.eventCategories",
  eventSubcategories: "plataforma.nomencladores.catalogs.eventSubcategories",
};

const CATALOG_HINT_KEYS: Record<CatalogKey, string> = {
  languages: "plataforma.nomencladores.hints.languages",
  hobbyCategories: "plataforma.nomencladores.hints.hobbyCategories",
  hobbies: "plataforma.nomencladores.hints.hobbies",
  communityCategories: "plataforma.nomencladores.hints.communityCategories",
  communitySubcategories: "plataforma.nomencladores.hints.communitySubcategories",
  eventCategories: "plataforma.nomencladores.hints.eventCategories",
  eventSubcategories: "plataforma.nomencladores.hints.eventSubcategories",
};

const DELETE_WARNING_KEYS: Record<CatalogKey, string> = {
  languages: "plataforma.nomencladores.deleteWarnings.languages",
  hobbyCategories: "plataforma.nomencladores.deleteWarnings.hobbyCategories",
  hobbies: "plataforma.nomencladores.deleteWarnings.hobbies",
  communityCategories: "plataforma.nomencladores.deleteWarnings.communityCategories",
  communitySubcategories: "plataforma.nomencladores.deleteWarnings.communitySubcategories",
  eventCategories: "plataforma.nomencladores.deleteWarnings.eventCategories",
  eventSubcategories: "plataforma.nomencladores.deleteWarnings.eventSubcategories",
};

const FIELD_LABEL_KEYS: Record<CatalogField, string> = {
  code: "plataforma.nomencladores.fields.code",
  label: "plataforma.nomencladores.fields.label",
  order: "plataforma.nomencladores.fields.order",
  emoji: "plataforma.nomencladores.fields.emoji",
  parent: "plataforma.nomencladores.fields.parent",
  categoryType: "plataforma.nomencladores.fields.categoryType",
  description: "plataforma.nomencladores.fields.description",
  icon: "plataforma.nomencladores.fields.icon",
};

const CATEGORY_TYPE_LABEL_KEYS: Record<string, string> = {
  sports: "plataforma.nomencladores.categoryTypes.sports",
  cultural: "plataforma.nomencladores.categoryTypes.cultural",
  leisure: "plataforma.nomencladores.categoryTypes.leisure",
  travel: "plataforma.nomencladores.categoryTypes.travel",
  party: "plataforma.nomencladores.categoryTypes.party",
  motorcycle: "plataforma.nomencladores.categoryTypes.motorcycle",
  other: "plataforma.nomencladores.categoryTypes.other",
};

const ERROR_KEYS: Record<CatalogsErrorKind, string> = {
  invalido: "errors.catalogs.invalido",
  sin_acceso: "errors.catalogs.sinAcceso",
  no_encontrado: "errors.catalogs.noEncontrado",
  conflicto_servidor: "errors.catalogs.conflictoServidor",
  demasiadas_paginas: "errors.catalogs.demasiadasPaginas",
  desconocido: "errors.catalogs.desconocido",
};

const MAX_LENGTH: Partial<Record<CatalogField, number>> = {
  code: 32,
  label: 100,
  emoji: 8,
  icon: 50,
};

const FIELD = "w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700";
const LABEL = "mb-1 block text-sm font-medium text-text-form";

function initialValues(item: CatalogItem | null): CatalogFormValues {
  return {
    code: item?.code ?? "",
    label: item?.label ?? "",
    order: item?.order !== null && item?.order !== undefined ? String(item.order) : "0",
    emoji: item?.emoji ?? "",
    parent: item?.parent ?? "",
    categoryType: item?.categoryType ?? "other",
    description: item?.description ?? "",
    icon: item?.icon ?? "",
    isActive: item?.isActive ?? true,
  };
}

function ItemDialog({
  catalog,
  editing,
  parents,
  onClose,
}: {
  catalog: CatalogKey;
  editing: CatalogItem | "new";
  parents: CatalogItem[];
  onClose: () => void;
}) {
  const t = useTranslations();
  const config = CATALOG_CONFIG[catalog];
  const save = useSaveCatalogItem(catalog);
  const [values, setValues] = useState<CatalogFormValues>(() => initialValues(editing === "new" ? null : editing));

  const canSubmit =
    values.label.trim().length > 0 &&
    (!config.fields.includes("code") || values.code.trim().length > 0) &&
    (!config.fields.includes("parent") || values.parent !== "");

  function set<K extends keyof CatalogFormValues>(key: K, value: CatalogFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    save.reset();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    save.mutate({ id: editing === "new" ? null : editing.id, values }, { onSuccess: onClose });
  }

  function renderField(field: CatalogField) {
    const id = `nomenclador-${field}`;
    const label = (
      <label htmlFor={id} className={LABEL}>
        {t(FIELD_LABEL_KEYS[field])}
      </label>
    );
    if (field === "parent") {
      return (
        <div key={field}>
          {label}
          <select id={id} value={values.parent} onChange={(event) => set("parent", event.target.value)} className={FIELD}>
            <option value="">{t("plataforma.nomencladores.chooseParent")}</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (field === "categoryType") {
      return (
        <div key={field}>
          {label}
          <select
            id={id}
            value={values.categoryType}
            onChange={(event) => set("categoryType", event.target.value)}
            className={FIELD}
          >
            {EVENT_CATEGORY_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(CATEGORY_TYPE_LABEL_KEYS[value])}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (field === "description") {
      return (
        <div key={field}>
          {label}
          <textarea
            id={id}
            rows={2}
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            className={FIELD}
          />
        </div>
      );
    }
    return (
      <div key={field}>
        {label}
        <input
          id={id}
          type={field === "order" ? "number" : "text"}
          min={field === "order" ? 0 : undefined}
          maxLength={MAX_LENGTH[field]}
          value={values[field]}
          onChange={(event) => set(field, event.target.value)}
          className={FIELD}
        />
      </div>
    );
  }

  return (
    <Dialog
      open
      titleId="nomenclador-dialog-title"
      title={editing === "new" ? t("plataforma.nomencladores.newItem") : t("plataforma.nomencladores.editItem")}
      onClose={close}
      pending={save.isPending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {config.fields.map(renderField)}
        <label className="flex items-center gap-2 text-sm text-text-form">
          <input type="checkbox" checked={values.isActive} onChange={(event) => set("isActive", event.target.checked)} />
          {t("plataforma.nomencladores.activeLabel")}
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || save.isPending}>
            {t("common.save")}
          </Button>
          <Button type="button" variant="secondary" disabled={save.isPending} onClick={close}>
            {t("common.cancel")}
          </Button>
        </div>
        {save.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(save.error, ERROR_KEYS, t, "errors.catalogs.desconocido")}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function CatalogTable({ catalog }: { catalog: CatalogKey }) {
  const t = useTranslations();
  const config = CATALOG_CONFIG[catalog];
  const items = useCatalog(catalog);
  const parents = useCatalog(config.parentCatalog ?? null);
  const remove = useDeleteCatalogItem(catalog);
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [toDelete, setToDelete] = useState<CatalogItem | null>(null);

  const parentLabel = new Map((parents.data ?? []).map((parent) => [parent.id, parent.label]));

  const columns: TableColumn<CatalogItem>[] = [
    { key: "label", header: t(FIELD_LABEL_KEYS.label), render: (item) => item.label || "—" },
  ];
  if (config.fields.includes("code")) {
    columns.push({ key: "code", header: t(FIELD_LABEL_KEYS.code), render: (item) => item.code ?? "—" });
  }
  if (config.fields.includes("emoji")) {
    columns.push({ key: "emoji", header: t(FIELD_LABEL_KEYS.emoji), render: (item) => item.emoji ?? "—" });
  }
  if (config.fields.includes("icon")) {
    columns.push({ key: "icon", header: t(FIELD_LABEL_KEYS.icon), render: (item) => item.icon ?? "—" });
  }
  if (config.fields.includes("categoryType")) {
    columns.push({
      key: "categoryType",
      header: t(FIELD_LABEL_KEYS.categoryType),
      render: (item) =>
        item.categoryType && CATEGORY_TYPE_LABEL_KEYS[item.categoryType]
          ? t(CATEGORY_TYPE_LABEL_KEYS[item.categoryType])
          : (item.categoryType ?? "—"),
    });
  }
  if (config.fields.includes("parent")) {
    columns.push({
      key: "parent",
      header: t(FIELD_LABEL_KEYS.parent),
      render: (item) => (item.parent ? (parentLabel.get(item.parent) ?? item.parent) : "—"),
    });
  }
  if (config.fields.includes("order")) {
    columns.push({ key: "order", header: t(FIELD_LABEL_KEYS.order), render: (item) => item.order ?? "—" });
  }
  if (catalog === "communityCategories") {
    columns.push({
      key: "count",
      header: t("plataforma.nomencladores.communitiesCountHeader"),
      render: (item) => item.count ?? "—",
    });
  }
  columns.push(
    {
      key: "active",
      header: t("plataforma.nomencladores.stateHeader"),
      render: (item) => (
        <Badge tone={item.isActive ? "success" : "neutral"}>
          {item.isActive ? t("plataforma.nomencladores.activeBadge") : t("plataforma.nomencladores.inactiveBadge")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("plataforma.nomencladores.actionsHeader")}</span>,
      render: (item) => (
        <span className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditing(item)}>
            {t("plataforma.nomencladores.edit")}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              remove.reset();
              setToDelete(item);
            }}
          >
            {t("plataforma.nomencladores.delete")}
          </Button>
        </span>
      ),
    },
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-secondary">{t(CATALOG_HINT_KEYS[catalog])}</p>
      <div>
        <Button type="button" onClick={() => setEditing("new")}>
          {t("plataforma.nomencladores.newItem")}
        </Button>
      </div>
      {items.isError ? (
        <ErrorState
          title={t("plataforma.nomencladores.loadError")}
          description={errorKindText(items.error, ERROR_KEYS, t, "errors.catalogs.desconocido")}
        />
      ) : !items.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : items.data.length === 0 ? (
        <EmptyState title={t("plataforma.nomencladores.empty")} />
      ) : (
        <>
          <Table<CatalogItem>
            caption={t(CATALOG_LABEL_KEYS[catalog])}
            rows={items.data}
            getRowKey={(item) => item.id}
            columns={columns}
          />
          <p className="text-sm text-text-secondary">
            {t("plataforma.nomencladores.count", { count: items.data.length })}
          </p>
        </>
      )}

      {editing ? (
        <ItemDialog
          key={editing === "new" ? "new" : editing.id}
          catalog={catalog}
          editing={editing}
          parents={parents.data ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        title={t("plataforma.nomencladores.deleteTitle", { name: toDelete?.label ?? "" })}
        description={
          <>
            <span>{t(DELETE_WARNING_KEYS[catalog])}</span>
            {remove.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(remove.error, ERROR_KEYS, t, "errors.catalogs.desconocido")}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.nomencladores.delete")}
        pending={remove.isPending}
        onCancel={() => {
          remove.reset();
          setToDelete(null);
        }}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
      />
    </div>
  );
}

export function NomencladoresPanel() {
  const t = useTranslations();
  const [catalog, setCatalog] = useState<SelectorKey>("languages");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="nomencladores-catalog" className={LABEL}>
          {t("plataforma.nomencladores.catalogLabel")}
        </label>
        <select
          id="nomencladores-catalog"
          value={catalog}
          onChange={(event) => setCatalog(event.target.value as SelectorKey)}
          className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        >
          <optgroup label={t("plataforma.nomencladores.groups.general")}>
            {CATALOG_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(CATALOG_LABEL_KEYS[key])}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("plataforma.nomencladores.groups.training")}>
            {TRAINING_CATALOG_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(TRAINING_CATALOG_LABEL_KEYS[key])}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      {isTrainingCatalog(catalog) ? (
        <TrainingCatalog key={catalog} catalog={catalog} />
      ) : (
        <CatalogTable key={catalog} catalog={catalog} />
      )}
    </div>
  );
}
