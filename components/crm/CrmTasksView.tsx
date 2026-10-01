"use client";

/**
 * Tareas (puntos 14-15): «Mis tareas» por cubos (hoy, próximas,
 * atrasadas, completadas) con contadores; dirección ve además todo el
 * equipo y filtra por responsable. Completar, poner en curso, cancelar,
 * editar, crear y registrar la actividad desde la tarea.
 */
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCrmTaskCounts, useCrmTasks, useUpdateTask } from "@/hooks/useCrm";
import type { CrmTask, CrmTaskCounts } from "@/lib/api/crmTypes";
import { formatDateTime } from "@/lib/crm/format";
import {
  CRM_ACTIVITY_KIND_LABELS,
  CRM_PRIORITY_LABELS,
  CRM_TASK_STATUS_LABELS,
  crmLabel,
} from "@/lib/crm/labels";
import { crmAccountHref, crmOpportunityHref } from "@/lib/crm/nav";

import { useCrmContext } from "./CrmShell";
import { CRM_REMINDER_LABELS } from "./QuickActivityDialog";
import { TaskDialog } from "./work/TaskDialog";
import { CRM_PAGE_SIZE, CrmUserFilter, Pager, useCrmErrorText } from "./work/shared";

export interface CrmTasksViewProps {
  isManager: boolean;
  userId: number;
}

type Bucket = keyof CrmTaskCounts;
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "today", label: "crm.tasks.buckets.today" },
  { key: "upcoming", label: "crm.tasks.buckets.upcoming" },
  { key: "overdue", label: "crm.tasks.buckets.overdue" },
  { key: "done", label: "crm.tasks.buckets.done" },
];

export function CrmTasksView({ isManager, userId }: CrmTasksViewProps) {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const { openActivity } = useCrmContext();
  const [bucket, setBucket] = useState<Bucket>("today");
  const [team, setTeam] = useState(false);
  const [assignee, setAssignee] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CrmTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<CrmTask | null>(null);

  const counts = useCrmTaskCounts();
  const showTeam = isManager && team;
  const tasks = useCrmTasks({
    bucket,
    mine: showTeam ? "false" : undefined,
    assignee: showTeam ? assignee : "",
    page,
    page_size: CRM_PAGE_SIZE,
  });
  const update = useUpdateTask();
  const cancel = useUpdateTask();

  const rows = tasks.data?.results ?? [];
  const count = tasks.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / CRM_PAGE_SIZE));

  function reminderText(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) return t("crm.tasks.noReminder");
    const key = CRM_REMINDER_LABELS[minutes];
    return key ? t(key) : t("crm.tasks.reminderMinutes", { minutes });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text-base">{t("pages.plataforma.comercialTareas.title")}</h1>
        <Button
          type="button"
          onClick={() => setCreating(true)}
        >
          {t("crm.tasks.new")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div role="group" aria-label={t("crm.tasks.bucketsLabel")} className="flex flex-wrap gap-1">
          {BUCKETS.map(({ key, label }) => (
            <Button
              key={key}
              type="button"
              variant={bucket === key ? "primary" : "secondary"}
              aria-pressed={bucket === key}
              onClick={() => {
                setBucket(key);
                setPage(1);
              }}
            >
              {t("crm.tasks.bucketWithCount", {
                label: t(label),
                count: counts.data?.[key] ?? 0,
              })}
            </Button>
          ))}
        </div>
        {isManager ? (
          <>
            <Button
              type="button"
              variant={team ? "primary" : "secondary"}
              aria-pressed={team}
              onClick={() => {
                setTeam(!team);
                setAssignee("");
                setPage(1);
              }}
            >
              {t("crm.tasks.wholeTeam")}
            </Button>
            {team ? (
              <CrmUserFilter
                id="crm-task-f-assignee"
                label={t("crm.tasks.assigneeFilter")}
                allLabel={t("crm.tasks.allAssignees")}
                value={assignee}
                onChange={(value) => {
                  setAssignee(value);
                  setPage(1);
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>

      {update.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorText(update.error)}
        </p>
      ) : null}

      {tasks.isLoading ? (
        <p role="status" className="text-sm text-text-secondary">
          {t("crm.common.loading")}
        </p>
      ) : tasks.isError ? (
        <ErrorState title={t("crm.tasks.loadError")} description={errorText(tasks.error)} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("crm.tasks.empty")} description={t("crm.tasks.emptyHint")} />
      ) : (
        <>
          <ul aria-label={t("crm.tasks.listLabel")} className="flex flex-col gap-2">
            {rows.map((task) => {
              const open = task.status === "pending" || task.status === "in_progress";
              const busy = update.isPending && update.variables?.id === task.id;
              const urgent = task.priority === "urgent" || task.priority === "high";
              return (
                <li key={task.id} className="rounded-lg border border-border bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-text-base">{task.title || t("crm.tasks.untitled")}</p>
                      <p className="text-sm text-text-secondary">
                        {task.account ? (
                          <Link href={crmAccountHref(task.account)} className="text-primary-700 underline">
                            {task.account_name}
                          </Link>
                        ) : (
                          t("crm.tasks.noAccount")
                        )}
                        {task.contact_name ? ` · ${task.contact_name}` : ""}
                        {task.opportunity ? (
                          <>
                            {" · "}
                            <Link href={crmOpportunityHref(task.opportunity)} className="text-primary-700 underline">
                              {task.opportunity_name}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {task.is_overdue && open ? <Badge tone="error">{t("crm.tasks.overdue")}</Badge> : null}
                      {urgent ? (
                        <Badge tone="error">{t("crm.tasks.priorityBadge", { priority: crmLabel(CRM_PRIORITY_LABELS, task.priority, t) })}</Badge>
                      ) : (
                        <Badge>{t("crm.tasks.priorityBadge", { priority: crmLabel(CRM_PRIORITY_LABELS, task.priority, t) })}</Badge>
                      )}
                      <Badge tone={task.status === "done" ? "success" : "info"}>
                        {crmLabel(CRM_TASK_STATUS_LABELS, task.status, t)}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-text-base">
                    <span className={task.is_overdue && open ? "font-semibold text-error" : ""}>
                      {t("crm.tasks.due", { when: formatDateTime(task.due_at) })}
                    </span>
                    {" · "}
                    {crmLabel(CRM_ACTIVITY_KIND_LABELS, task.kind, t)}
                    {" · "}
                    {t("crm.tasks.reminderLine", { reminder: reminderText(task.reminder_minutes) })}
                    {showTeam && task.assignee_detail ? ` · ${task.assignee_detail.name}` : ""}
                  </p>
                  {task.description ? <p className="mt-1 text-sm text-text-secondary">{task.description}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {open ? (
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => update.mutate({ id: task.id, status: "done" })}
                      >
                        {t("crm.tasks.complete")}
                      </Button>
                    ) : null}
                    {task.status === "pending" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => update.mutate({ id: task.id, status: "in_progress" })}
                      >
                        {t("crm.tasks.start")}
                      </Button>
                    ) : null}
                    {open ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          cancel.reset();
                          setCancelling(task);
                        }}
                      >
                        {t("crm.tasks.cancel")}
                      </Button>
                    ) : null}
                    <Button type="button" variant="secondary" onClick={() => setEditing(task)}>
                      {t("crm.tasks.edit")}
                    </Button>
                    {task.account ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          openActivity({
                            account: { id: task.account as number, name: task.account_name },
                            opportunity: task.opportunity ?? null,
                            kind: task.kind,
                          })
                        }
                      >
                        {t("crm.tasks.registerActivity")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pager
            page={page}
            count={count}
            onPage={setPage}
            labels={{
              previous: t("crm.tasks.pager.previous"),
              next: t("crm.tasks.pager.next"),
              summary: t("crm.tasks.pager.summary", { page, pages, count }),
            }}
          />
        </>
      )}

      {creating ? <TaskDialog isManager={isManager} userId={userId} onClose={() => setCreating(false)} /> : null}
      {editing ? (
        <TaskDialog key={editing.id} task={editing} isManager={isManager} userId={userId} onClose={() => setEditing(null)} />
      ) : null}

      <ConfirmDialog
        open={!!cancelling}
        title={t("crm.tasks.cancelTitle")}
        description={
          <>
            <p>{t("crm.tasks.cancelBody", { title: cancelling?.title ?? "" })}</p>
            {cancel.isError ? (
              <p role="alert" className="mt-2 text-error">
                {errorText(cancel.error)}
              </p>
            ) : null}
          </>
        }
        confirmLabel={t("crm.tasks.cancelConfirm")}
        cancelLabel={t("crm.tasks.cancelKeep")}
        pending={cancel.isPending}
        onCancel={() => {
          cancel.reset();
          setCancelling(null);
        }}
        onConfirm={() => {
          if (cancelling) cancel.mutate({ id: cancelling.id, status: "cancelled" }, { onSuccess: () => setCancelling(null) });
        }}
      />
    </div>
  );
}
