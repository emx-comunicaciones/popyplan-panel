"use client";

/**
 * Plantillas de entrenamiento **de Popyplan** (Nomencladores,
 * `docs/PANEL.md` §17.2 del backend): las que la app ofrece para registrar
 * rápido. Se listan con `?scope=system` y se crean con `system: true`;
 * **nunca** se listan rutinas de nadie (el entrenamiento es privado).
 *
 * Cada plantilla lleva sus ejercicios en orden: del catálogo de su
 * disciplina o con nombre libre (con su métrica), y los valores por
 * defecto de cada serie según la métrica. Guardar manda la lista entera,
 * que **reemplaza** la anterior. La lógica pura (estado, validación,
 * cuerpo) vive en `lib/training/templateForm.ts`.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table, type TableColumn } from "@/components/ui/Table";
import {
  useDeleteTemplate,
  useSaveTemplate,
  useSystemTemplates,
  useTrainingDisciplines,
  useTrainingExercises,
} from "@/hooks/useTrainingCatalog";
import type { TrainingExercise, TrainingMetric, TrainingTemplate } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import {
  METRIC_FIELDS,
  TRAINING_METRICS,
  detachExercises,
  emptyItem,
  formToWrite,
  moveItem,
  templateToForm,
  validateTemplateForm,
  type ItemValueField,
  type TemplateForm,
  type TemplateFormError,
  type TemplateItemForm,
} from "@/lib/training/templateForm";

import {
  ActiveBadge,
  FIELD,
  LABEL,
  METRIC_LABEL_KEYS,
  NameFields,
  TRAINING_ERROR_FALLBACK,
  TRAINING_ERROR_KEYS,
} from "./trainingShared";

const FORM_ERROR_KEYS: Record<TemplateFormError, string> = {
  nameRequired: "plataforma.nomencladores.training.formErrors.nameRequired",
  disciplineRequired: "plataforma.nomencladores.training.formErrors.disciplineRequired",
  invalidNumber: "plataforma.nomencladores.training.formErrors.invalidNumber",
  itemNameRequired: "plataforma.nomencladores.training.formErrors.itemNameRequired",
  itemSetsRange: "plataforma.nomencladores.training.formErrors.itemSetsRange",
};

/** Claves relativas a `plataforma.nomencladores.training.items`. */
const VALUE_LABEL_KEYS: Record<ItemValueField, string> = {
  reps: "reps",
  weight_kg: "weight",
  seconds: "seconds",
  distance_km: "distance",
};

/** Paso del `<input type="number">` de cada valor: decimales en peso y distancia. */
const VALUE_STEP: Record<ItemValueField, string> = {
  reps: "1",
  weight_kg: "0.5",
  seconds: "1",
  distance_km: "0.01",
};

function ItemRow({
  item,
  index,
  total,
  exercises,
  onChange,
  onMove,
  onRemove,
}: {
  item: TemplateItemForm;
  index: number;
  total: number;
  exercises: TrainingExercise[];
  onChange: (patch: Partial<TemplateItemForm>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("plataforma.nomencladores.training.items");
  const tAll = useTranslations();
  const n = index + 1;
  const id = `plantilla-item-${item.key}`;
  const selected = exercises.find((e) => String(e.id) === item.exerciseId);
  const metric: TrainingMetric = selected?.metric ?? item.metric;

  function chooseExercise(value: string) {
    if (!value) {
      // A nombre libre: se conserva el nombre y la métrica del ejercicio que había.
      onChange({ exerciseId: "", name: selected?.name ?? item.name, metric });
      return;
    }
    const exercise = exercises.find((e) => String(e.id) === value);
    onChange({ exerciseId: value, metric: exercise?.metric ?? item.metric });
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-text-base">{t("itemLabel", { n })}</span>
        <span className="flex gap-1">
          <Button type="button" variant="secondary" disabled={index === 0} onClick={() => onMove(-1)}>
            {t("moveUp", { n })}
          </Button>
          <Button type="button" variant="secondary" disabled={index === total - 1} onClick={() => onMove(1)}>
            {t("moveDown", { n })}
          </Button>
          <Button type="button" variant="danger" onClick={onRemove}>
            {t("remove", { n })}
          </Button>
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className={item.exerciseId ? "sm:col-span-3" : undefined}>
          <label htmlFor={`${id}-exercise`} className={LABEL}>
            {t("source", { n })}
          </label>
          <select
            id={`${id}-exercise`}
            value={item.exerciseId}
            onChange={(event) => chooseExercise(event.target.value)}
            className={FIELD}
          >
            <option value="">{t("freeName")}</option>
            {exercises
              .filter((e) => e.is_active !== false || String(e.id) === item.exerciseId)
              .map((e) => (
                <option key={e.id} value={String(e.id)}>
                  {e.is_active === false ? t("inactiveOption", { name: e.name_es }) : e.name_es}
                </option>
              ))}
            {item.exerciseId && !selected ? (
              // El ejercicio guardado no está en el catálogo cargado (aún
              // cargando, o de otra disciplina): se enseña por su nombre.
              <option value={item.exerciseId}>{item.name || item.exerciseId}</option>
            ) : null}
          </select>
        </div>
        {!item.exerciseId ? (
          <>
            <div>
              <label htmlFor={`${id}-name`} className={LABEL}>
                {t("name", { n })}
              </label>
              <input
                id={`${id}-name`}
                type="text"
                maxLength={100}
                value={item.name}
                onChange={(event) => onChange({ name: event.target.value })}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor={`${id}-metric`} className={LABEL}>
                {t("metric", { n })}
              </label>
              <select
                id={`${id}-metric`}
                value={item.metric}
                onChange={(event) => onChange({ metric: event.target.value as TrainingMetric })}
                className={FIELD}
              >
                {TRAINING_METRICS.map((m) => (
                  <option key={m} value={m}>
                    {tAll(METRIC_LABEL_KEYS[m])}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <div>
          <label htmlFor={`${id}-sets`} className={LABEL}>
            {t("sets", { n })}
          </label>
          <input
            id={`${id}-sets`}
            type="number"
            min={1}
            max={50}
            value={item.sets}
            onChange={(event) => onChange({ sets: event.target.value })}
            className="w-24 rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        {METRIC_FIELDS[metric].map((field) => (
          <div key={field}>
            <label htmlFor={`${id}-${field}`} className={LABEL}>
              {t(VALUE_LABEL_KEYS[field], { n })}
            </label>
            <input
              id={`${id}-${field}`}
              type="number"
              min={0}
              step={VALUE_STEP[field]}
              value={item[field]}
              onChange={(event) => onChange({ [field]: event.target.value })}
              className="w-28 rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
          </div>
        ))}
      </div>
    </li>
  );
}

function TemplateDialog({ editing, onClose }: { editing: TrainingTemplate | "new"; onClose: () => void }) {
  const t = useTranslations();
  const save = useSaveTemplate();
  const disciplines = useTrainingDisciplines();
  const original = editing === "new" ? null : editing;
  const [form, setForm] = useState<TemplateForm>(() => templateToForm(original));
  const exercises = useTrainingExercises(form.disciplineId ? Number(form.disciplineId) : null, form.disciplineId !== "");
  const catalog = exercises.data ?? [];
  const formError = validateTemplateForm(form);

  function set<K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function changeDiscipline(value: string) {
    const byId = new Map(catalog.map((e) => [String(e.id), { name: e.name_es, metric: e.metric }]));
    setForm((prev) => ({ ...prev, disciplineId: value, items: detachExercises(prev.items, byId) }));
  }

  function updateItem(index: number, patch: Partial<TemplateItemForm>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function close() {
    save.reset();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formError) return;
    const body = formToWrite(form, original, (id) => catalog.find((e) => String(e.id) === id)?.metric);
    save.mutate({ id: original ? original.id : null, body }, { onSuccess: onClose });
  }

  // Una disciplina desactivada no se puede elegir (el backend solo acepta
  // activas), salvo la que ya tiene la plantilla, que se sigue enseñando.
  const disciplineOptions = (disciplines.data ?? []).filter(
    (d) => d.is_active !== false || String(d.id) === form.disciplineId,
  );

  return (
    <Dialog
      open
      titleId="plantilla-dialog-title"
      title={
        editing === "new"
          ? t("plataforma.nomencladores.training.newTemplate")
          : t("plataforma.nomencladores.training.editTemplate")
      }
      onClose={close}
      pending={save.isPending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <NameFields idPrefix="plantilla" values={form} onChange={(field, value) => set(field, value)} />
        <div>
          <label htmlFor="plantilla-description" className={LABEL}>
            {t("plataforma.nomencladores.training.fields.description")}
          </label>
          <textarea
            id="plantilla-description"
            rows={2}
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            className={FIELD}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="plantilla-discipline" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.discipline")}
            </label>
            <select
              id="plantilla-discipline"
              value={form.disciplineId}
              onChange={(event) => changeDiscipline(event.target.value)}
              aria-describedby={disciplines.isError ? "plantilla-disciplines-error" : undefined}
              className={FIELD}
            >
              <option value="">{t("plataforma.nomencladores.training.chooseDiscipline")}</option>
              {disciplineOptions.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name_es}
                </option>
              ))}
              {original && !disciplineOptions.some((d) => String(d.id) === form.disciplineId) &&
              form.disciplineId === String(original.discipline.id) ? (
                <option value={form.disciplineId}>{original.discipline.name}</option>
              ) : null}
            </select>
            {disciplines.isError ? (
              <p id="plantilla-disciplines-error" role="alert" className="mt-1 text-xs text-error">
                {t("plataforma.nomencladores.training.disciplinesLoadError")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="plantilla-duration" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.duration")}
            </label>
            <input
              id="plantilla-duration"
              type="number"
              min={0}
              value={form.duration_minutes}
              onChange={(event) => set("duration_minutes", event.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="plantilla-distance" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.distance")}
            </label>
            <input
              id="plantilla-distance"
              type="number"
              min={0}
              step="0.01"
              value={form.distance_km}
              onChange={(event) => set("distance_km", event.target.value)}
              className={FIELD}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label htmlFor="plantilla-order" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.order")}
            </label>
            <input
              id="plantilla-order"
              type="number"
              min={0}
              value={form.order}
              onChange={(event) => set("order", event.target.value)}
              className="w-24 rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-form">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => set("is_active", event.target.checked)}
            />
            {t("plataforma.nomencladores.activeLabel")}
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-text-base">
            {t("plataforma.nomencladores.training.items.heading")}
          </legend>
          <p className="text-xs text-text-secondary">{t("plataforma.nomencladores.training.items.hint")}</p>
          {exercises.isError ? (
            <p role="alert" className="text-xs text-error">
              {t("plataforma.nomencladores.training.items.exercisesLoadError")}
            </p>
          ) : null}
          {form.items.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("plataforma.nomencladores.training.items.empty")}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {form.items.map((item, index) => (
                <ItemRow
                  key={item.key}
                  item={item}
                  index={index}
                  total={form.items.length}
                  exercises={catalog}
                  onChange={(patch) => updateItem(index, patch)}
                  onMove={(delta) => set("items", moveItem(form.items, index, delta))}
                  onRemove={() => set("items", form.items.filter((_, i) => i !== index))}
                />
              ))}
            </ol>
          )}
          <div>
            <Button type="button" variant="secondary" onClick={() => set("items", [...form.items, emptyItem()])}>
              {t("plataforma.nomencladores.training.items.add")}
            </Button>
          </div>
        </fieldset>

        {formError ? (
          <p className="text-xs text-text-secondary">{t(FORM_ERROR_KEYS[formError])}</p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={formError !== null || save.isPending}>
            {t("common.save")}
          </Button>
          <Button type="button" variant="secondary" disabled={save.isPending} onClick={close}>
            {t("common.cancel")}
          </Button>
        </div>
        {save.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(save.error, TRAINING_ERROR_KEYS, t, TRAINING_ERROR_FALLBACK)}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

export function PlantillasEntrenamientoCatalog() {
  const t = useTranslations();
  const templates = useSystemTemplates();
  const remove = useDeleteTemplate();
  const [editing, setEditing] = useState<TrainingTemplate | "new" | null>(null);
  const [toDelete, setToDelete] = useState<TrainingTemplate | null>(null);

  const columns: TableColumn<TrainingTemplate>[] = [
    { key: "name", header: t("plataforma.nomencladores.training.fields.name"), render: (tpl) => tpl.name_es },
    {
      key: "discipline",
      header: t("plataforma.nomencladores.training.fields.discipline"),
      render: (tpl) => tpl.discipline.name,
    },
    {
      key: "items",
      header: t("plataforma.nomencladores.training.fields.itemsCount"),
      render: (tpl) => tpl.items.length,
    },
    {
      key: "duration",
      header: t("plataforma.nomencladores.training.fields.duration"),
      render: (tpl) => (tpl.duration_minutes === null ? "—" : tpl.duration_minutes),
    },
    { key: "order", header: t("plataforma.nomencladores.training.fields.order"), render: (tpl) => tpl.order },
    {
      key: "active",
      header: t("plataforma.nomencladores.stateHeader"),
      render: (tpl) => <ActiveBadge active={tpl.is_active} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("plataforma.nomencladores.actionsHeader")}</span>,
      render: (tpl) => (
        <span className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditing(tpl)}>
            {t("plataforma.nomencladores.edit")}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              remove.reset();
              setToDelete(tpl);
            }}
          >
            {t("plataforma.nomencladores.delete")}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-secondary">{t("plataforma.nomencladores.training.hints.templates")}</p>
      <div>
        <Button type="button" onClick={() => setEditing("new")}>
          {t("plataforma.nomencladores.training.newTemplate")}
        </Button>
      </div>
      {templates.isError ? (
        <ErrorState
          title={t("plataforma.nomencladores.loadError")}
          description={errorKindText(templates.error, TRAINING_ERROR_KEYS, t, TRAINING_ERROR_FALLBACK)}
        />
      ) : !templates.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : templates.data.length === 0 ? (
        <EmptyState title={t("plataforma.nomencladores.empty")} />
      ) : (
        <>
          <Table<TrainingTemplate>
            caption={t("plataforma.nomencladores.training.catalogs.templates")}
            rows={templates.data}
            getRowKey={(tpl) => String(tpl.id)}
            columns={columns}
          />
          <p className="text-sm text-text-secondary">
            {t("plataforma.nomencladores.count", { count: templates.data.length })}
          </p>
        </>
      )}

      {editing ? (
        <TemplateDialog
          key={editing === "new" ? "new" : editing.id}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        title={t("plataforma.nomencladores.deleteTitle", { name: toDelete?.name_es ?? "" })}
        description={
          <>
            <span>{t("plataforma.nomencladores.training.deleteWarnings.template")}</span>
            {remove.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(remove.error, TRAINING_ERROR_KEYS, t, TRAINING_ERROR_FALLBACK)}
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
