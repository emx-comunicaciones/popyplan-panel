"use client";

/**
 * Crear o editar una tarea (puntos 14-15 de la spec). Lo usan «Tareas» y
 * «Calendario» (desde un día, con la fecha ya puesta). Se cierra solo al
 * guardar; el error del backend se pinta dentro del diálogo.
 */
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { PickerOption } from "@/components/ui/SearchPicker";
import { useCreateTask, useUpdateTask } from "@/hooks/useCrm";
import type { CrmTask } from "@/lib/api/crmTypes";
import { fromLocalInput, toLocalInput } from "@/lib/crm/format";
import {
  CRM_ACTIVITY_KINDS,
  CRM_ACTIVITY_KIND_LABELS,
  CRM_PRIORITIES,
  CRM_PRIORITY_LABELS,
  CRM_TASK_STATUSES,
  CRM_TASK_STATUS_LABELS,
} from "@/lib/crm/labels";

import { CrmAccountPicker, CrmUserSelect, crmInputClass, crmLabelClass } from "../common";
import { CRM_REMINDER_LABELS } from "../QuickActivityDialog";
import { CRM_REMINDER_MINUTES, useCrmErrorText } from "./shared";

export interface TaskDialogProps {
  /** Con tarea se edita; sin ella se crea. */
  task?: CrmTask;
  /** `YYYY-MM-DD`: fecha propuesta al crear desde un día del calendario. */
  presetDate?: string;
  isManager: boolean;
  userId: number;
  onClose: () => void;
}

function defaultDue(presetDate?: string): string {
  if (presetDate) return `${presetDate}T09:00`;
  const date = new Date(Date.now() + 86_400_000);
  date.setHours(10, 0, 0, 0);
  return toLocalInput(date.toISOString());
}

export function TaskDialog({ task, presetDate, isManager, userId, onClose }: TaskDialogProps) {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const titleId = useId();
  const editing = !!task;
  const [account, setAccount] = useState<PickerOption | null>(null);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [kind, setKind] = useState<string>(task?.kind ?? "call");
  const [due, setDue] = useState(task ? toLocalInput(task.due_at) : defaultDue(presetDate));
  const [priority, setPriority] = useState<string>(task?.priority ?? "normal");
  const [reminder, setReminder] = useState<number | "">(task ? (task.reminder_minutes ?? "") : 60);
  const [assignee, setAssignee] = useState<number | null>(task ? (task.assignee ?? null) : userId || null);
  const [status, setStatus] = useState<string>(task?.status ?? "pending");

  const create = useCreateTask();
  const update = useUpdateTask();
  const mutation = editing ? update : create;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const dueAt = fromLocalInput(due);
    if (!dueAt || !title.trim()) return;
    const data = {
      title: title.trim(),
      description,
      kind: kind as CrmTask["kind"],
      due_at: dueAt,
      priority: priority as CrmTask["priority"],
      reminder_minutes: reminder === "" ? null : reminder,
      assignee: isManager ? assignee : (task?.assignee ?? userId ?? null),
    };
    if (task) {
      update.mutate({ id: task.id, ...data, status: status as CrmTask["status"] }, { onSuccess: onClose });
    } else {
      create.mutate({ ...data, account: account?.id ?? null }, { onSuccess: onClose });
    }
  }

  return (
    <Dialog
      open
      titleId={titleId}
      title={editing ? t("crm.tasks.dialog.editTitle") : t("crm.tasks.dialog.newTitle")}
      onClose={onClose}
      pending={mutation.isPending}
      widthClassName="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {editing ? (
          task.account_name ? (
            <p className="text-sm text-text-secondary">
              {t("crm.tasks.dialog.accountFixed", { name: task.account_name })}
            </p>
          ) : null
        ) : (
          <CrmAccountPicker
            id="crm-task-account"
            label={t("crm.tasks.dialog.accountOptional")}
            value={account}
            onChange={setAccount}
          />
        )}
        <div>
          <label htmlFor="crm-task-title" className={crmLabelClass}>
            {t("crm.tasks.dialog.title")}
          </label>
          <input
            id="crm-task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={crmInputClass}
            required
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="crm-task-kind" className={crmLabelClass}>
              {t("crm.tasks.dialog.kind")}
            </label>
            <select id="crm-task-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={crmInputClass}>
              {CRM_ACTIVITY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(CRM_ACTIVITY_KIND_LABELS[k])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="crm-task-due" className={crmLabelClass}>
              {t("crm.tasks.dialog.dueAt")}
            </label>
            <input
              id="crm-task-due"
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={crmInputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="crm-task-priority" className={crmLabelClass}>
              {t("crm.tasks.dialog.priority")}
            </label>
            <select
              id="crm-task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={crmInputClass}
            >
              {CRM_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(CRM_PRIORITY_LABELS[p])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="crm-task-reminder" className={crmLabelClass}>
              {t("crm.tasks.dialog.reminder")}
            </label>
            <select
              id="crm-task-reminder"
              value={reminder}
              onChange={(e) => setReminder(e.target.value === "" ? "" : Number(e.target.value))}
              className={crmInputClass}
            >
              <option value="">{t("crm.tasks.dialog.noReminder")}</option>
              {CRM_REMINDER_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {t(CRM_REMINDER_LABELS[m])}
                </option>
              ))}
            </select>
          </div>
          {editing ? (
            <div>
              <label htmlFor="crm-task-status" className={crmLabelClass}>
                {t("crm.tasks.dialog.status")}
              </label>
              <select
                id="crm-task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={crmInputClass}
              >
                {CRM_TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(CRM_TASK_STATUS_LABELS[s])}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {isManager ? (
            <CrmUserSelect
              id="crm-task-assignee"
              label={t("crm.tasks.dialog.assignee")}
              value={assignee}
              onChange={setAssignee}
              allowEmpty
            />
          ) : null}
        </div>
        <div>
          <label htmlFor="crm-task-description" className={crmLabelClass}>
            {t("crm.tasks.dialog.description")}
          </label>
          <textarea
            id="crm-task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={crmInputClass}
          />
        </div>
        {mutation.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorText(mutation.error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("crm.common.saving") : t("crm.common.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
