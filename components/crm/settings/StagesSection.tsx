"use client";

/**
 * Fases del pipeline (punto 28): la misma lista sirve para el estado de
 * una entidad y el de una oportunidad. Se reordenan, se renombran y se
 * desactivan; nunca se borran.
 */
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCrmStages, useSaveStage } from "@/hooks/useCrm";
import type { CrmStage } from "@/lib/api/crmTypes";
import { CRM_STAGE_KIND_LABELS, crmLabel } from "@/lib/crm/labels";

import { crmInputClass, crmLabelClass } from "../common";
import { useCrmErrorText } from "../work/shared";

const KINDS = Object.keys(CRM_STAGE_KIND_LABELS);
const COLUMNS = [
  "crm.settings.stages.columns.name",
  "crm.settings.stages.columns.key",
  "crm.settings.stages.columns.order",
  "crm.settings.stages.columns.kind",
  "crm.settings.stages.columns.probability",
  "crm.settings.stages.columns.color",
  "crm.settings.stages.columns.status",
];
const SLUG = /^[a-z0-9_]+$/;

interface Draft {
  name: string;
  order: string;
  kind: string;
  probability: string;
  color: string;
  active: boolean;
}

const toDraft = (stage: CrmStage): Draft => ({
  name: stage.name,
  order: String(stage.order ?? 0),
  kind: stage.kind ?? "open",
  probability: String(stage.probability ?? 0),
  color: stage.color || "#9aa5b1",
  active: stage.is_active ?? true,
});

function validDraft(draft: Draft): boolean {
  const order = Number(draft.order);
  const probability = Number(draft.probability);
  return (
    draft.name.trim() !== "" &&
    draft.order.trim() !== "" &&
    Number.isInteger(order) &&
    order >= 0 &&
    draft.probability.trim() !== "" &&
    Number.isInteger(probability) &&
    probability >= 0 &&
    probability <= 100
  );
}

const toPayload = (draft: Draft) => ({
  name: draft.name.trim(),
  order: Number(draft.order),
  kind: draft.kind as CrmStage["kind"],
  probability: Number(draft.probability),
  color: draft.color,
  is_active: draft.active,
});

function StageRow({
  stage,
  editing,
  pending,
  onEdit,
  onCancel,
  onSave,
  onToggle,
}: {
  stage: CrmStage;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (draft: Draft) => void;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const [draft, setDraft] = useState<Draft>(() => toDraft(stage));
  const cell = "px-2 py-1.5 align-middle";
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const inactive = stage.is_active === false;

  if (!editing) {
    return (
      <tr className="border-b border-border-light">
        <td className={cell}>{stage.name}</td>
        <td className={cell}>
          <code className="text-xs">{stage.key}</code>
        </td>
        <td className={cell}>{stage.order}</td>
        <td className={cell}>{crmLabel(CRM_STAGE_KIND_LABELS, stage.kind, t)}</td>
        <td className={cell}>{t("crm.settings.stages.percent", { value: stage.probability ?? 0 })}</td>
        <td className={cell}>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full border border-border"
              style={{ backgroundColor: stage.color || "#9aa5b1" }}
            />
            <span className="text-xs">{stage.color}</span>
          </span>
        </td>
        <td className={cell}>{inactive ? t("crm.settings.stages.inactive") : t("crm.settings.stages.active")}</td>
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

  const small = "w-full rounded-md border border-border bg-white px-1.5 py-1 text-sm";
  return (
    <tr className="border-b border-border-light bg-border-light">
      <td className={cell}>
        <input
          aria-label={t("crm.settings.stages.nameOf", { name: stage.name })}
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          className={small}
        />
      </td>
      <td className={cell}>
        <code className="text-xs">{stage.key}</code>
      </td>
      <td className={cell}>
        <input
          type="number"
          min={0}
          aria-label={t("crm.settings.stages.orderOf", { name: stage.name })}
          value={draft.order}
          onChange={(e) => set({ order: e.target.value })}
          className={`${small} w-16`}
        />
      </td>
      <td className={cell}>
        <select
          aria-label={t("crm.settings.stages.kindOf", { name: stage.name })}
          value={draft.kind}
          onChange={(e) => set({ kind: e.target.value })}
          className={small}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(CRM_STAGE_KIND_LABELS[k])}
            </option>
          ))}
        </select>
      </td>
      <td className={cell}>
        <input
          type="number"
          min={0}
          max={100}
          aria-label={t("crm.settings.stages.probabilityOf", { name: stage.name })}
          value={draft.probability}
          onChange={(e) => set({ probability: e.target.value })}
          className={`${small} w-16`}
        />
      </td>
      <td className={cell}>
        <input
          type="color"
          aria-label={t("crm.settings.stages.colorOf", { name: stage.name })}
          value={draft.color}
          onChange={(e) => set({ color: e.target.value })}
          className="h-8 w-10 rounded border border-border bg-white"
        />
      </td>
      <td className={cell}>
        <label className="inline-flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
          {t("crm.settings.stages.active")}
        </label>
      </td>
      <td className={cell}>
        <div className="flex gap-1">
          <Button type="button" disabled={pending || !validDraft(draft)} onClick={() => onSave(draft)}>
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

function NewStageDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const titleId = useId();
  const save = useSaveStage();
  const [key, setKey] = useState("");
  const [draft, setDraft] = useState<Draft>({
    name: "",
    order: "0",
    kind: "open",
    probability: "0",
    color: "#1fb3ae",
    active: true,
  });
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const keyValid = SLUG.test(key);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!keyValid || !validDraft(draft)) return;
    save.mutate({ key, ...toPayload(draft) }, { onSuccess: onClose });
  }

  return (
    <Dialog open titleId={titleId} title={t("crm.settings.stages.newTitle")} onClose={onClose} pending={save.isPending}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="crm-stage-key" className={crmLabelClass}>
            {t("crm.settings.stages.key")}
          </label>
          <input
            id="crm-stage-key"
            value={key}
            onChange={(e) => setKey(e.target.value.trim())}
            aria-invalid={key !== "" && !keyValid}
            className={crmInputClass}
            required
          />
          <p className={`mt-1 text-xs ${key !== "" && !keyValid ? "text-error" : "text-text-secondary"}`}>
            {t("crm.settings.stages.keyHint")}
          </p>
        </div>
        <div>
          <label htmlFor="crm-stage-name" className={crmLabelClass}>
            {t("crm.settings.stages.name")}
          </label>
          <input
            id="crm-stage-name"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            className={crmInputClass}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="crm-stage-order" className={crmLabelClass}>
              {t("crm.settings.stages.order")}
            </label>
            <input
              id="crm-stage-order"
              type="number"
              min={0}
              value={draft.order}
              onChange={(e) => set({ order: e.target.value })}
              className={crmInputClass}
            />
          </div>
          <div>
            <label htmlFor="crm-stage-kind" className={crmLabelClass}>
              {t("crm.settings.stages.kind")}
            </label>
            <select id="crm-stage-kind" value={draft.kind} onChange={(e) => set({ kind: e.target.value })} className={crmInputClass}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(CRM_STAGE_KIND_LABELS[k])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="crm-stage-probability" className={crmLabelClass}>
              {t("crm.settings.stages.probability")}
            </label>
            <input
              id="crm-stage-probability"
              type="number"
              min={0}
              max={100}
              value={draft.probability}
              onChange={(e) => set({ probability: e.target.value })}
              className={crmInputClass}
            />
          </div>
          <div>
            <label htmlFor="crm-stage-color" className={crmLabelClass}>
              {t("crm.settings.stages.color")}
            </label>
            <input
              id="crm-stage-color"
              type="color"
              value={draft.color}
              onChange={(e) => set({ color: e.target.value })}
              className="h-9 w-full rounded border border-border bg-white"
            />
          </div>
        </div>
        {save.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorText(save.error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!keyValid || !validDraft(draft) || save.isPending}>
            {save.isPending ? t("crm.common.saving") : t("crm.settings.stages.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function StagesSection() {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const stages = useCrmStages();
  const save = useSaveStage();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const sorted = [...(stages.data ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <section aria-labelledby="crm-settings-stages" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="crm-settings-stages" className="text-lg font-semibold text-text-base">
          {t("crm.settings.stages.title")}
        </h2>
        <Button type="button" onClick={() => setCreating(true)}>
          {t("crm.settings.stages.new")}
        </Button>
      </div>
      <p className="rounded-md bg-border-light p-2 text-sm text-text-secondary">{t("crm.settings.stages.warning")}</p>
      {save.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorText(save.error)}
        </p>
      ) : null}
      {stages.isLoading ? (
        <p role="status" className="text-sm text-text-secondary">
          {t("crm.common.loading")}
        </p>
      ) : stages.isError ? (
        <ErrorState title={t("crm.settings.loadError")} description={errorText(stages.error)} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("crm.settings.stages.caption")}</caption>
            <thead>
              <tr className="border-b border-border text-text-secondary">
                {COLUMNS.map((column) => (
                  <th key={column} scope="col" className="px-2 py-1.5 font-semibold">
                    {t(column)}
                  </th>
                ))}
                <th scope="col" className="px-2 py-1.5 font-semibold">
                  <span className="sr-only">{t("common.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((stage) => (
                <StageRow
                  key={`${stage.id}-${editingId === stage.id}`}
                  stage={stage}
                  editing={editingId === stage.id}
                  pending={save.isPending}
                  onEdit={() => {
                    save.reset();
                    setEditingId(stage.id);
                  }}
                  onCancel={() => {
                    save.reset();
                    setEditingId(null);
                  }}
                  onSave={(draft) => save.mutate({ id: stage.id, ...toPayload(draft) }, { onSuccess: () => setEditingId(null) })}
                  onToggle={() => save.mutate({ id: stage.id, is_active: stage.is_active === false })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating ? <NewStageDialog onClose={() => setCreating(false)} /> : null}
    </section>
  );
}
