"use client";

/**
 * Avisos del CRM (punto 45): recordatorios, tareas vencidas, propuestas
 * sin respuesta, asignaciones… Se generan en el backend
 * (`crm.tasks.run_rules`, cada 15 min). El contador sale de `me/`.
 */
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import {
  useCrmMe,
  useCrmNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@/hooks/useCrm";
import { formatDateTime } from "@/lib/crm/format";
import { CRM_NOTIFICATION_KIND_LABELS, crmLabel } from "@/lib/crm/labels";
import { crmAccountHref } from "@/lib/crm/nav";

export function CrmNotificationsMenu() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const me = useCrmMe();
  const list = useCrmNotifications(open ? { page_size: 20 } : undefined);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = me.data?.unread_notifications ?? 0;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("crm.notifications.button", { count: unread })}
      >
        <span aria-hidden="true">{t("crm.notifications.short")}</span>
        {unread ? (
          <span aria-hidden="true" className="rounded-full bg-error px-1.5 text-xs font-semibold text-text-inverse">
            {unread}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-80 max-w-[90vw] rounded-md border border-border bg-white p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-text-base">{t("crm.notifications.title")}</p>
            {unread ? (
              <Button type="button" variant="secondary" onClick={() => markAll.mutate()}>
                {t("crm.notifications.readAll")}
              </Button>
            ) : null}
          </div>
          {list.isLoading ? <p className="text-sm text-text-secondary">{t("crm.common.loading")}</p> : null}
          {list.isError ? (
            <p role="alert" className="text-sm text-error">
              {t("crm.notifications.error")}
            </p>
          ) : null}
          {list.data && !list.data.results.length ? (
            <p className="text-sm text-text-secondary">{t("crm.notifications.empty")}</p>
          ) : null}
          <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {list.data?.results.map((n) => (
              <li key={n.id} className={`rounded px-2 py-1.5 text-sm ${n.read_at ? "" : "bg-primary-100"}`}>
                <p className="text-xs text-text-secondary">
                  {crmLabel(CRM_NOTIFICATION_KIND_LABELS, n.kind, t)} · {formatDateTime(n.created_at)}
                </p>
                {n.account ? (
                  <Link
                    href={crmAccountHref(n.account)}
                    onClick={() => {
                      if (!n.read_at) markRead.mutate(n.id);
                      setOpen(false);
                    }}
                    className="font-medium text-primary-700 underline"
                  >
                    {n.title}
                  </Link>
                ) : (
                  <p className="font-medium text-text-base">{n.title}</p>
                )}
                {n.body ? <p className="text-xs text-text-form">{n.body}</p> : null}
                {!n.read_at && !n.account ? (
                  <button type="button" className="text-xs text-primary-700 underline" onClick={() => markRead.mutate(n.id)}>
                    {t("crm.notifications.markRead")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
