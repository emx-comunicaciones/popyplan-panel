"use client";

/**
 * Disciplinas de entrenamiento (Nomencladores, `docs/PANEL.md` §17.1 del
 * backend): cada una con su tipo de medida (`strength`/`endurance`/
 * `route`), del que cuelgan ejercicios y plantillas. Borrar una disciplina
 * en uso responde 409 con el mensaje literal del backend, que se pinta tal
 * cual dentro del diálogo: la salida es desactivarla.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table, type TableColumn } from "@/components/ui/Table";
import { useDeleteDiscipline, useSaveDiscipline, useTrainingDisciplines } from "@/hooks/useTrainingCatalog";
import type { TrainingDiscipline, TrainingDisciplineKind } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

import {
  ActiveBadge,
  DISCIPLINE_KINDS,
  FIELD,
  KIND_LABEL_KEYS,
  LABEL,
  NameFields,
  TRAINING_ERROR_FALLBACK,
  TRAINING_ERROR_KEYS,
  labelFor,
  toInt,
  type NameValues,
} from "./trainingShared";

interface DisciplineForm extends NameValues {
  code: string;
  kind: TrainingDisciplineKind;
  icon: string;
  order: string;
  is_active: boolean;
}

function toForm(discipline: TrainingDiscipline | null): DisciplineForm {
  return {
    code: discipline?.code ?? "",
    name: discipline?.name_es ?? "",
    name_eu: discipline?.name_eu ?? "",
    name_ca: discipline?.name_ca ?? "",
    kind: discipline?.kind ?? "strength",
    icon: discipline?.icon ?? "",
    order: String(discipline?.order ?? 0),
    is_active: discipline?.is_active ?? true,
  };
}

function DisciplineDialog({ editing, onClose }: { editing: TrainingDiscipline | "new"; onClose: () => void }) {
  const t = useTranslations();
  const save = useSaveDiscipline();
  const [form, setForm] = useState<DisciplineForm>(() => toForm(editing === "new" ? null : editing));
  const canSubmit = form.code.trim().length > 0 && form.name.trim().length > 0;

  function set<K extends keyof DisciplineForm>(key: K, value: DisciplineForm[K]) {
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
          kind: form.kind,
          icon: form.icon.trim(),
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
      titleId="disciplina-dialog-title"
      title={
        editing === "new"
          ? t("plataforma.nomencladores.training.newDiscipline")
          : t("plataforma.nomencladores.training.editDiscipline")
      }
      onClose={close}
      pending={save.isPending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="disciplina-code" className={LABEL}>
            {t("plataforma.nomencladores.training.fields.code")}
          </label>
          <input
            id="disciplina-code"
            type="text"
            maxLength={32}
            value={form.code}
            onChange={(event) => set("code", event.target.value)}
            className={FIELD}
          />
        </div>
        <NameFields idPrefix="disciplina" values={form} onChange={(field, value) => set(field, value)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="disciplina-kind" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.kind")}
            </label>
            <select
              id="disciplina-kind"
              value={form.kind}
              onChange={(event) => set("kind", event.target.value as TrainingDisciplineKind)}
              className={FIELD}
            >
              {DISCIPLINE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(KIND_LABEL_KEYS[kind])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="disciplina-icon" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.icon")}
            </label>
            <input
              id="disciplina-icon"
              type="text"
              maxLength={32}
              value={form.icon}
              onChange={(event) => set("icon", event.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="disciplina-order" className={LABEL}>
              {t("plataforma.nomencladores.training.fields.order")}
            </label>
            <input
              id="disciplina-order"
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

export function DisciplinasCatalog() {
  const t = useTranslations();
  const disciplines = useTrainingDisciplines();
  const remove = useDeleteDiscipline();
  const [editing, setEditing] = useState<TrainingDiscipline | "new" | null>(null);
  const [toDelete, setToDelete] = useState<TrainingDiscipline | null>(null);

  const columns: TableColumn<TrainingDiscipline>[] = [
    { key: "name", header: t("plataforma.nomencladores.training.fields.name"), render: (d) => d.name_es },
    { key: "code", header: t("plataforma.nomencladores.training.fields.code"), render: (d) => d.code },
    {
      key: "kind",
      header: t("plataforma.nomencladores.training.fields.kind"),
      render: (d) => labelFor(KIND_LABEL_KEYS, d.kind, t),
    },
    { key: "icon", header: t("plataforma.nomencladores.training.fields.icon"), render: (d) => d.icon || "—" },
    { key: "order", header: t("plataforma.nomencladores.training.fields.order"), render: (d) => d.order ?? 0 },
    {
      key: "active",
      header: t("plataforma.nomencladores.stateHeader"),
      render: (d) => <ActiveBadge active={d.is_active !== false} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("plataforma.nomencladores.actionsHeader")}</span>,
      render: (d) => (
        <span className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditing(d)}>
            {t("plataforma.nomencladores.edit")}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              remove.reset();
              setToDelete(d);
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
      <p className="text-xs text-text-secondary">{t("plataforma.nomencladores.training.hints.disciplines")}</p>
      <div>
        <Button type="button" onClick={() => setEditing("new")}>
          {t("plataforma.nomencladores.training.newDiscipline")}
        </Button>
      </div>
      {disciplines.isError ? (
        <ErrorState
          title={t("plataforma.nomencladores.loadError")}
          description={errorKindText(disciplines.error, TRAINING_ERROR_KEYS, t, TRAINING_ERROR_FALLBACK)}
        />
      ) : !disciplines.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : disciplines.data.length === 0 ? (
        <EmptyState title={t("plataforma.nomencladores.empty")} />
      ) : (
        <>
          <Table<TrainingDiscipline>
            caption={t("plataforma.nomencladores.training.catalogs.disciplines")}
            rows={disciplines.data}
            getRowKey={(d) => String(d.id)}
            columns={columns}
          />
          <p className="text-sm text-text-secondary">
            {t("plataforma.nomencladores.count", { count: disciplines.data.length })}
          </p>
        </>
      )}

      {editing ? (
        <DisciplineDialog
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
            <span>{t("plataforma.nomencladores.training.deleteWarnings.discipline")}</span>
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
