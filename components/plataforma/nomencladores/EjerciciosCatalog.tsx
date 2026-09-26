"use client";

/**
 * Ejercicios del catálogo de entrenamiento (Nomencladores, `docs/PANEL.md`
 * §17.1 del backend), filtrables por disciplina. Cada ejercicio es de una
 * disciplina (se escribe con `discipline_id`) y tiene una métrica que
 * decide la forma de sus series (`weight_reps`/`reps`/`time`/`distance`).
 * Borrarlo no rompe nada: plantillas y entrenos que lo usaban conservan su
 * nombre como ejercicio libre.
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
  useDeleteExercise,
  useSaveExercise,
  useTrainingDisciplines,
  useTrainingExercises,
} from "@/hooks/useTrainingCatalog";
import type { TrainingDiscipline, TrainingExercise, TrainingMetric, TrainingMuscleGroup } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { TRAINING_METRICS } from "@/lib/training/templateForm";

import {
  ActiveBadge,
  FIELD,
  LABEL,
  METRIC_LABEL_KEYS,
  MUSCLE_GROUPS,
  MUSCLE_LABEL_KEYS,
  NameFields,
  TRAINING_ERROR_FALLBACK,
  TRAINING_ERROR_KEYS,
  labelFor,
  toInt,
  type NameValues,
} from "./trainingShared";

interface ExerciseForm extends NameValues {
  code: string;
  disciplineId: string;
  muscle_group: TrainingMuscleGroup | "";
  metric: TrainingMetric;
  order: string;
  is_active: boolean;
}

function toForm(exercise: TrainingExercise | null, defaultDiscipline: string): ExerciseForm {
  return {
    code: exercise?.code ?? "",
    name: exercise?.name_es ?? "",
    name_eu: exercise?.name_eu ?? "",
    name_ca: exercise?.name_ca ?? "",
    disciplineId: exercise ? String(exercise.discipline.id) : defaultDiscipline,
    muscle_group: (exercise?.muscle_group as TrainingMuscleGroup | "" | undefined) ?? "",
    metric: exercise?.metric ?? "weight_reps",
    order: String(exercise?.order ?? 0),
    is_active: exercise?.is_active ?? true,
  };
}

function ExerciseDialog({
  editing,
  disciplines,
  defaultDiscipline,
  onClose,
}: {
  editing: TrainingExercise | "new";
  disciplines: TrainingDiscipline[];
  defaultDiscipline: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const save = useSaveExercise();
  const [form, setForm] = useState<ExerciseForm>(() =>
    toForm(editing === "new" ? null : editing, defaultDiscipline),
  );
  const canSubmit = form.code.trim().length > 0 && form.name.trim().length > 0 && form.disciplineId !== "";

  function set<K extends keyof ExerciseForm>(key: K, value: ExerciseForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    save.reset();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    save.mutate(
      {
        id: editing === "new" ? null : editing.id,
        body: {
          code: form.code.trim(),
          name: form.name.trim(),
          name_eu: form.name_eu.trim(),
          name_ca: form.name_ca.trim(),
          discipline_id: Number(form.disciplineId),
          muscle_group: form.muscle_group,
          metric: form.metric,
          order: toInt(form.order, 0),
          is_active: form.is_active,
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      titleId="ejercicio-dialog-title"
      title={
        editing === "new"
          ? t("plataforma.nomencladores.training.newExercise")
          : t("plataforma.nomencladores.training.editExercise")
      }
      onClose={close}
      pending={save.isPending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ejercicio-code" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.code")}
            </label>
            <input
              id="ejercicio-code"
              type="text"
              maxLength={48}
              value={form.code}
              onChange={(event) => set("code", event.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="ejercicio-discipline" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.discipline")}
            </label>
            <select
              id="ejercicio-discipline"
              value={form.disciplineId}
              onChange={(event) => set("disciplineId", event.target.value)}
              className={FIELD}
            >
              <option value="">{t("plataforma.nomencladores.training.chooseDiscipline")}</option>
              {disciplines.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name_es}
                </option>
              ))}
            </select>
          </div>
        </div>
        <NameFields idPrefix="ejercicio" values={form} onChange={(field, value) => set(field, value)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="ejercicio-metric" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.metric")}
            </label>
            <select
              id="ejercicio-metric"
              value={form.metric}
              onChange={(event) => set("metric", event.target.value as TrainingMetric)}
              className={FIELD}
            >
              {TRAINING_METRICS.map((metric) => (
                <option key={metric} value={metric}>
                  {t(METRIC_LABEL_KEYS[metric])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ejercicio-muscle" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.muscleGroup")}
            </label>
            <select
              id="ejercicio-muscle"
              value={form.muscle_group}
              onChange={(event) => set("muscle_group", event.target.value as TrainingMuscleGroup | "")}
              className={FIELD}
            >
              <option value="">{t("plataforma.nomencladores.training.muscleGroups.none")}</option>
              {MUSCLE_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {t(MUSCLE_LABEL_KEYS[group])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ejercicio-order" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.order")}
            </label>
            <input
              id="ejercicio-order"
              type="number"
              min={0}
              value={form.order}
              onChange={(event) => set("order", event.target.value)}
              className={FIELD}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-form">
          <input type="checkbox" checked={form.is_active} onChange={(event) => set("is_active", event.target.checked)} />
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
            {errorKindText(save.error, TRAINING_ERROR_KEYS, t, TRAINING_ERROR_FALLBACK)}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

export function EjerciciosCatalog() {
  const t = useTranslations();
  const disciplines = useTrainingDisciplines();
  const [filter, setFilter] = useState("");
  const exercises = useTrainingExercises(filter ? Number(filter) : null);
  const remove = useDeleteExercise();
  const [editing, setEditing] = useState<TrainingExercise | "new" | null>(null);
  const [toDelete, setToDelete] = useState<TrainingExercise | null>(null);

  const columns: TableColumn<TrainingExercise>[] = [
    { key: "name", header: t("plataforma.nomencladores.training.fields.name"), render: (e) => e.name_es },
    { key: "code", header: t("plataforma.nomencladores.training.fields.code"), render: (e) => e.code },
    {
      key: "discipline",
      header: t("plataforma.nomencladores.training.fields.discipline"),
      render: (e) => e.discipline.name,
    },
    {
      key: "metric",
      header: t("plataforma.nomencladores.training.fields.metric"),
      render: (e) => labelFor(METRIC_LABEL_KEYS, e.metric, t),
    },
    {
      key: "muscle",
      header: t("plataforma.nomencladores.training.fields.muscleGroup"),
      render: (e) => (e.muscle_group ? labelFor(MUSCLE_LABEL_KEYS, e.muscle_group, t) : "—"),
    },
    { key: "order", header: t("plataforma.nomencladores.training.fields.order"), render: (e) => e.order ?? 0 },
    {
      key: "active",
      header: t("plataforma.nomencladores.stateHeader"),
      render: (e) => <ActiveBadge active={e.is_active !== false} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("plataforma.nomencladores.actionsHeader")}</span>,
      render: (e) => (
        <span className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditing(e)}>
            {t("plataforma.nomencladores.edit")}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              remove.reset();
              setToDelete(e);
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
      <p className="text-xs text-text-secondary">{t("plataforma.nomencladores.training.hints.exercises")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="ejercicios-filter" className={LABEL}>
            {t("plataforma.nomencladores.training.fields.discipline")}
          </label>
          <select
            id="ejercicios-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-describedby={disciplines.isError ? "ejercicios-disciplines-error" : undefined}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            <option value="">{t("plataforma.nomencladores.training.allDisciplines")}</option>
            {(disciplines.data ?? []).map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name_es}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" onClick={() => setEditing("new")}>
          {t("plataforma.nomencladores.training.newExercise")}
        </Button>
      </div>
      {disciplines.isError ? (
        <p id="ejercicios-disciplines-error" role="alert" className="text-xs text-error">
          {t("plataforma.nomencladores.training.disciplinesLoadError")}
        </p>
      ) : null}
      {exercises.isError ? (
        <ErrorState
          title={t("plataforma.nomencladores.loadError")}
          description={errorKindText(exercises.error, TRAINING_ERROR_KEYS, t, TRAINING_ERROR_FALLBACK)}
        />
      ) : !exercises.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : exercises.data.length === 0 ? (
        <EmptyState title={t("plataforma.nomencladores.empty")} />
      ) : (
        <>
          <Table<TrainingExercise>
            caption={t("plataforma.nomencladores.training.catalogs.exercises")}
            rows={exercises.data}
            getRowKey={(e) => String(e.id)}
            columns={columns}
          />
          <p className="text-sm text-text-secondary">
            {t("plataforma.nomencladores.count", { count: exercises.data.length })}
          </p>
        </>
      )}

      {editing ? (
        <ExerciseDialog
          key={editing === "new" ? "new" : editing.id}
          editing={editing}
          disciplines={disciplines.data ?? []}
          defaultDiscipline={filter}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        title={t("plataforma.nomencladores.deleteTitle", { name: toDelete?.name_es ?? "" })}
        description={
          <>
            <span>{t("plataforma.nomencladores.training.deleteWarnings.exercise")}</span>
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
