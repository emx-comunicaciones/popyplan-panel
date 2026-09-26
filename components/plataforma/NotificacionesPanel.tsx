"use client";

/**
 * Notificaciones del admin de plataforma (bloque 3, 2026-09-26): dos
 * pestañas con el mismo selector de botones que `ContratosPanel`.
 *
 * - **Enviar** (`useSendAdminNotification`): a una persona (elegida con el
 *   buscador de cuentas de Roles, con retardo) o a todas las cuentas
 *   activas. Siempre con `ConfirmDialog` y el error dentro; el envío a
 *   todas avisa de que incluye al personal y no se puede deshacer. El
 *   envío del admin **nunca** usa plantillas (el backend las salta).
 * - **Plantillas** (`useNotificationTemplates` y compañía): tabla
 *   paginada, alta/edición en un `Dialog` y borrado con `ConfirmDialog`.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import {
  useDeleteNotificationTemplate,
  useNotificationTemplates,
  useSaveNotificationTemplate,
  useSendAdminNotification,
  type AdminNotificationsErrorKind,
} from "@/hooks/useAdminNotifications";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useUserSearch } from "@/hooks/useUserSearch";
import type {
  AdminSendNotificationResponse,
  NotificationPriorityName,
  NotificationTemplateInput,
  NotificationTemplateRow,
  NotificationTypeName,
} from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

const SECTIONS = ["enviar", "plantillas"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_LABEL_KEYS: Record<Section, string> = {
  enviar: "plataforma.notificaciones.tabSend",
  plantillas: "plataforma.notificaciones.tabTemplates",
};

export const NOTIFICATION_TYPES: readonly NotificationTypeName[] = [
  "announcement",
  "system",
  "warning",
  "message",
  "dm_request",
  "plan_invitation",
  "plan_update",
  "plan_reminder",
  "plan_cancelled",
  "plan_completed",
  "review_received",
  "report_resolved",
  "help_request",
  "account_suspended",
  "survey",
  "support_help_request",
  "support_link",
];

export const NOTIFICATION_TYPE_LABEL_KEYS: Record<NotificationTypeName, string> = {
  announcement: "plataforma.notificaciones.types.announcement",
  system: "plataforma.notificaciones.types.system",
  warning: "plataforma.notificaciones.types.warning",
  message: "plataforma.notificaciones.types.message",
  dm_request: "plataforma.notificaciones.types.dmRequest",
  plan_invitation: "plataforma.notificaciones.types.planInvitation",
  plan_update: "plataforma.notificaciones.types.planUpdate",
  plan_reminder: "plataforma.notificaciones.types.planReminder",
  plan_cancelled: "plataforma.notificaciones.types.planCancelled",
  plan_completed: "plataforma.notificaciones.types.planCompleted",
  review_received: "plataforma.notificaciones.types.reviewReceived",
  report_resolved: "plataforma.notificaciones.types.reportResolved",
  help_request: "plataforma.notificaciones.types.helpRequest",
  account_suspended: "plataforma.notificaciones.types.accountSuspended",
  survey: "plataforma.notificaciones.types.survey",
  support_help_request: "plataforma.notificaciones.types.supportHelpRequest",
  support_link: "plataforma.notificaciones.types.supportLink",
};

const PRIORITIES: readonly NotificationPriorityName[] = ["low", "medium", "high", "urgent"];

const PRIORITY_LABEL_KEYS: Record<NotificationPriorityName, string> = {
  low: "plataforma.notificaciones.priorities.low",
  medium: "plataforma.notificaciones.priorities.medium",
  high: "plataforma.notificaciones.priorities.high",
  urgent: "plataforma.notificaciones.priorities.urgent",
};

const ERROR_KEYS: Record<AdminNotificationsErrorKind, string> = {
  invalido: "errors.adminNotifications.invalido",
  sin_acceso: "errors.adminNotifications.sinAcceso",
  no_encontrado: "errors.adminNotifications.noEncontrado",
  pagina_inexistente: "errors.adminNotifications.paginaInexistente",
  desconocido: "errors.adminNotifications.desconocido",
};

const TITLE_MAX = 200;
const FIELD = "w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700";
const LABEL = "mb-1 block text-sm font-medium text-text-form";

interface Recipient {
  id: number;
  label: string;
}

function SendTab() {
  const t = useTranslations();
  const send = useSendAdminNotification();
  const [target, setTarget] = useState<"user" | "all">("user");
  const [search, setSearch] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationTypeName>("announcement");
  const [priority, setPriority] = useState<NotificationPriorityName>("medium");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<AdminSendNotificationResponse | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const results = useUserSearch(debouncedSearch);

  const canSubmit =
    title.trim().length > 0 &&
    title.trim().length <= TITLE_MAX &&
    message.trim().length > 0 &&
    (target === "all" || recipient !== null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    send.reset();
    setResult(null);
    setConfirming(true);
  }

  function confirm() {
    send.mutate(
      {
        title: title.trim(),
        message: message.trim(),
        notification_type: type,
        priority,
        target,
        ...(target === "user" && recipient ? { user_id: recipient.id } : {}),
      },
      {
        onSuccess: (data) => {
          setResult(data);
          setConfirming(false);
          setTitle("");
          setMessage("");
        },
      },
    );
  }

  return (
    <Card title={t("plataforma.notificaciones.sendTitle")}>
      <p className="mb-3 text-xs text-text-secondary">{t("plataforma.notificaciones.sendHint")}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className={LABEL}>{t("plataforma.notificaciones.targetLabel")}</legend>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="notificaciones-target"
              checked={target === "user"}
              onChange={() => setTarget("user")}
            />
            {t("plataforma.notificaciones.targetUser")}
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="notificaciones-target"
              checked={target === "all"}
              onChange={() => setTarget("all")}
            />
            {t("plataforma.notificaciones.targetAll")}
          </label>
        </fieldset>

        {target === "user" ? (
          <div>
            <label htmlFor="notificaciones-search" className={LABEL}>
              {t("plataforma.notificaciones.searchLabel")}
            </label>
            <input
              id="notificaciones-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={FIELD}
            />
            {results.data && results.data.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-1 rounded-md border border-border p-2 text-sm">
                {results.data.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      className="text-left text-primary-700 underline"
                      onClick={() => {
                        setRecipient({ id: user.id, label: user.username || user.email });
                        setSearch("");
                      }}
                    >
                      {t("plataforma.bloqueos.searchResult", { username: user.username || "—", email: user.email })}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-1 text-sm text-text-base">
              {recipient
                ? t("plataforma.notificaciones.recipientSelected", { name: recipient.label })
                : t("plataforma.notificaciones.recipientNone")}
            </p>
          </div>
        ) : (
          <p className="text-sm text-text-base">{t("plataforma.notificaciones.targetAllHint")}</p>
        )}

        <div>
          <label htmlFor="notificaciones-title" className={LABEL}>
            {t("plataforma.notificaciones.titleLabel")}
          </label>
          <input
            id="notificaciones-title"
            type="text"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="notificaciones-message" className={LABEL}>
            {t("plataforma.notificaciones.messageLabel")}
          </label>
          <textarea
            id="notificaciones-message"
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="notificaciones-type" className={LABEL}>
              {t("plataforma.notificaciones.typeLabel")}
            </label>
            <select
              id="notificaciones-type"
              value={type}
              onChange={(event) => setType(event.target.value as NotificationTypeName)}
              className={FIELD}
            >
              {NOTIFICATION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(NOTIFICATION_TYPE_LABEL_KEYS[value])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="notificaciones-priority" className={LABEL}>
              {t("plataforma.notificaciones.priorityLabel")}
            </label>
            <select
              id="notificaciones-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as NotificationPriorityName)}
              className={FIELD}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {t(PRIORITY_LABEL_KEYS[value])}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Button type="submit" disabled={!canSubmit}>
            {t("plataforma.notificaciones.sendAction")}
          </Button>
        </div>
        {result ? (
          <p role="status" className="text-sm text-success">
            {result.recipients === undefined
              ? t("plataforma.notificaciones.sentQueued")
              : t("plataforma.notificaciones.sentTo", { count: result.recipients })}
          </p>
        ) : null}
      </form>

      <ConfirmDialog
        open={confirming}
        title={
          target === "all" ? t("plataforma.notificaciones.confirmAllTitle") : t("plataforma.notificaciones.confirmUserTitle")
        }
        description={
          <>
            <span>
              {target === "all"
                ? t("plataforma.notificaciones.confirmAllDescription")
                : t("plataforma.notificaciones.confirmUserDescription", { name: recipient?.label ?? "" })}
            </span>
            {send.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(send.error, ERROR_KEYS, t, "errors.adminNotifications.desconocido")}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.notificaciones.sendAction")}
        pending={send.isPending}
        onCancel={() => {
          send.reset();
          setConfirming(false);
        }}
        onConfirm={confirm}
      />
    </Card>
  );
}

const EMPTY_TEMPLATE: NotificationTemplateInput = {
  name: "",
  notification_type: "system",
  title_template: "",
  message_template: "",
  email_subject_template: "",
  email_body_template: "",
  // Nace inactiva a propósito: activa, cambia al momento el texto de todas
  // las notificaciones del sistema de su tipo (gana la activa más antigua).
  is_active: false,
  priority: "medium",
};

function TemplateDialog({ editing, onClose }: { editing: NotificationTemplateRow | "new"; onClose: () => void }) {
  const t = useTranslations();
  const save = useSaveNotificationTemplate();
  const [values, setValues] = useState<NotificationTemplateInput>(() =>
    editing === "new"
      ? EMPTY_TEMPLATE
      : {
          name: editing.name,
          notification_type: editing.notification_type,
          title_template: editing.title_template,
          message_template: editing.message_template,
          email_subject_template: editing.email_subject_template,
          email_body_template: editing.email_body_template,
          is_active: editing.is_active,
          priority: editing.priority,
        },
  );

  const canSubmit =
    values.name.trim().length > 0 && values.title_template.trim().length > 0 && values.message_template.trim().length > 0;

  function set<K extends keyof NotificationTemplateInput>(key: K, value: NotificationTemplateInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    save.mutate({ id: editing === "new" ? null : editing.id, data: values }, { onSuccess: onClose });
  }

  return (
    <Dialog
      open
      titleId="plantilla-dialog-title"
      title={editing === "new" ? t("plataforma.notificaciones.newTemplate") : t("plataforma.notificaciones.editTemplate")}
      onClose={() => {
        save.reset();
        onClose();
      }}
      pending={save.isPending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-xs text-text-secondary">{t("plataforma.notificaciones.templateFormHint")}</p>
        <div>
          <label htmlFor="plantilla-name" className={LABEL}>
            {t("plataforma.notificaciones.nameLabel")}
          </label>
          <input
            id="plantilla-name"
            type="text"
            maxLength={100}
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="plantilla-type" className={LABEL}>
              {t("plataforma.notificaciones.typeLabel")}
            </label>
            <select
              id="plantilla-type"
              value={values.notification_type}
              onChange={(event) => set("notification_type", event.target.value as NotificationTypeName)}
              className={FIELD}
            >
              {NOTIFICATION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(NOTIFICATION_TYPE_LABEL_KEYS[value])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="plantilla-priority" className={LABEL}>
              {t("plataforma.notificaciones.priorityLabel")}
            </label>
            <select
              id="plantilla-priority"
              value={values.priority}
              onChange={(event) => set("priority", event.target.value as NotificationPriorityName)}
              className={FIELD}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {t(PRIORITY_LABEL_KEYS[value])}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="plantilla-title" className={LABEL}>
            {t("plataforma.notificaciones.titleTemplateLabel")}
          </label>
          <input
            id="plantilla-title"
            type="text"
            maxLength={TITLE_MAX}
            value={values.title_template}
            onChange={(event) => set("title_template", event.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="plantilla-message" className={LABEL}>
            {t("plataforma.notificaciones.messageTemplateLabel")}
          </label>
          <textarea
            id="plantilla-message"
            rows={3}
            value={values.message_template}
            onChange={(event) => set("message_template", event.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="plantilla-email-subject" className={LABEL}>
            {t("plataforma.notificaciones.emailSubjectLabel")}
          </label>
          <input
            id="plantilla-email-subject"
            type="text"
            maxLength={TITLE_MAX}
            value={values.email_subject_template}
            onChange={(event) => set("email_subject_template", event.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="plantilla-email-body" className={LABEL}>
            {t("plataforma.notificaciones.emailBodyLabel")}
          </label>
          <textarea
            id="plantilla-email-body"
            rows={3}
            value={values.email_body_template}
            onChange={(event) => set("email_body_template", event.target.value)}
            className={FIELD}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-form">
          <input type="checkbox" checked={values.is_active} onChange={(event) => set("is_active", event.target.checked)} />
          {t("plataforma.notificaciones.activeLabel")}
        </label>
        <p className="-mt-2 text-xs text-text-secondary">{t("plataforma.notificaciones.activeHint")}</p>
        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || save.isPending}>
            {t("common.save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => {
              save.reset();
              onClose();
            }}
          >
            {t("common.cancel")}
          </Button>
        </div>
        {save.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(save.error, ERROR_KEYS, t, "errors.adminNotifications.desconocido")}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function TemplatesTab() {
  const t = useTranslations();
  const [page, setPage] = useState(1);
  const templates = useNotificationTemplates(page);
  const remove = useDeleteNotificationTemplate();
  const [editing, setEditing] = useState<NotificationTemplateRow | "new" | null>(null);
  const [toDelete, setToDelete] = useState<NotificationTemplateRow | null>(null);

  useEffect(() => {
    if (templates.error?.kind === "pagina_inexistente" && page > 1) setPage(1);
  }, [templates.error, page]);

  function closeDelete() {
    remove.reset();
    setToDelete(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-secondary">{t("plataforma.notificaciones.templatesHint")}</p>
      <div>
        <Button type="button" onClick={() => setEditing("new")}>
          {t("plataforma.notificaciones.newTemplate")}
        </Button>
      </div>
      {templates.isError ? (
        <ErrorState
          title={t("plataforma.notificaciones.templatesLoadError")}
          description={errorKindText(templates.error, ERROR_KEYS, t, "errors.adminNotifications.desconocido")}
        />
      ) : !templates.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : templates.data.results.length === 0 ? (
        <EmptyState title={t("plataforma.notificaciones.templatesEmpty")} />
      ) : (
        <>
          <Table<NotificationTemplateRow>
            caption={t("plataforma.notificaciones.templatesCaption")}
            rows={templates.data.results}
            getRowKey={(row) => String(row.id)}
            columns={[
              { key: "name", header: t("plataforma.notificaciones.nameLabel"), render: (row) => row.name },
              {
                key: "type",
                header: t("plataforma.notificaciones.typeLabel"),
                render: (row) => t(NOTIFICATION_TYPE_LABEL_KEYS[row.notification_type] ?? "plataforma.notificaciones.types.system"),
              },
              {
                key: "priority",
                header: t("plataforma.notificaciones.priorityLabel"),
                render: (row) => (PRIORITY_LABEL_KEYS[row.priority] ? t(PRIORITY_LABEL_KEYS[row.priority]) : row.priority),
              },
              {
                key: "active",
                header: t("plataforma.notificaciones.stateHeader"),
                render: (row) => (
                  <Badge tone={row.is_active ? "success" : "neutral"}>
                    {row.is_active ? t("plataforma.notificaciones.activeBadge") : t("plataforma.notificaciones.inactiveBadge")}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: <span className="sr-only">{t("plataforma.notificaciones.actionsHeader")}</span>,
                render: (row) => (
                  <span className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => setEditing(row)}>
                      {t("plataforma.notificaciones.edit")}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        remove.reset();
                        setToDelete(row);
                      }}
                    >
                      {t("plataforma.notificaciones.delete")}
                    </Button>
                  </span>
                ),
              },
            ]}
          />
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!templates.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t("plataforma.usuarios.previous")}
            </Button>
            <span className="text-sm text-text-secondary">
              {t("plataforma.notificaciones.templatesCount", { count: templates.data.count })}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={!templates.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t("plataforma.usuarios.next")}
            </Button>
          </div>
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
        title={t("plataforma.notificaciones.deleteTitle")}
        description={
          <>
            <span>{t("plataforma.notificaciones.deleteDescription", { name: toDelete?.name ?? "" })}</span>
            {remove.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(remove.error, ERROR_KEYS, t, "errors.adminNotifications.desconocido")}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.notificaciones.delete")}
        pending={remove.isPending}
        onCancel={closeDelete}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
      />
    </div>
  );
}

export function NotificacionesPanel() {
  const t = useTranslations();
  const [section, setSection] = useState<Section>("enviar");

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">{t("plataforma.notificaciones.sectionsLegend")}</legend>
        {SECTIONS.map((value) => (
          <Button
            key={value}
            type="button"
            variant={section === value ? "primary" : "secondary"}
            aria-pressed={section === value}
            onClick={() => setSection(value)}
          >
            {t(SECTION_LABEL_KEYS[value])}
          </Button>
        ))}
      </fieldset>
      {section === "enviar" ? <SendTab /> : <TemplatesTab />}
    </div>
  );
}
