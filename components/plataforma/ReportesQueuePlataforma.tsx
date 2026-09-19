"use client";

/**
 * Cola global de reportes (tarea W5, `docs/SEGURIDAD_Y_MODERACION.md`
 * §4): `GET /api/safety/reports/queue/?status=` sin `organization` — todo
 * lo global más lo escalado por una entidad (`safety/services/
 * reports.py::queue`). Reutiliza `useReportsQueue` (ya soporta `orgId`
 * opcional desde esta tarea) en vez de duplicar la lógica del panel de
 * entidad (`ReportesQueue.tsx`), con una columna «Entidad» y una
 * insignia «Escalado» que esa vista no necesita. Sin paginación (fix
 * de carry-over W6): la ruta nunca pagina de verdad, ver
 * `hooks/useReportsQueue.ts`.
 *
 * **i18n (tarea 5 del plan de i18n):** cierra el puente que dejó la
 * tarea 4 en `lib/reports/labels.ts` — usa `reasonLabelKey`/
 * `statusLabelKey` (clave) en vez de `reasonLabel`/`statusLabel`
 * (texto); esas dos últimas se borran de `lib/reports/labels.ts` al no
 * quedar ningún consumidor.
 */
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useReportsQueue, type ReportsQueueErrorKind, type ReportsQueueFilters } from "@/hooks/useReportsQueue";
import type { ReportRow } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeFor, activeLanguage } from "@/lib/i18n/locale";
import { reasonLabelKey, statusLabelKey } from "@/lib/reports/labels";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(localeFor(activeLanguage()));
}

// Mismas claves que `ReportesQueue.tsx` (entidad): las dos consumen
// `useReportsQueue`, así que comparten `kind`/mensajes.
const REPORTS_QUEUE_ERROR_KEYS: Record<ReportsQueueErrorKind, string> = {
  sin_acceso: "errors.reportsQueue.sinAcceso",
  desconocido: "errors.reportsQueue.desconocido",
};

export function ReportesQueuePlataforma() {
  const t = useTranslations();
  const [status, setStatus] = useState<ReportsQueueFilters["status"] | "">("pending");

  const reports = useReportsQueue(undefined, { status: status || undefined });

  function reasonText(reason: string): string {
    const key = reasonLabelKey(reason);
    return key ? t(key) : reason;
  }

  function statusText(value: string): string {
    const key = statusLabelKey(value);
    return key ? t(key) : value;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="plataforma-reportes-status" className="mb-1 block text-sm font-medium text-text-form">
          {t("plataforma.reportes.statusLabel")}
        </label>
        <select
          id="plataforma-reportes-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ReportsQueueFilters["status"] | "");
          }}
          className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        >
          <option value="">{t("plataforma.reportes.statusAll")}</option>
          <option value="pending">{t("reports.status.pending")}</option>
          <option value="in_review">{t("reports.status.inReview")}</option>
          <option value="resolved">{t("reports.status.resolved")}</option>
        </select>
      </div>

      {reports.isError ? (
        reports.error.kind === "sin_acceso" ? (
          <EmptyState title={t("common.noAccess")} description={t("errors.reportsQueue.sinAcceso")} />
        ) : (
          <ErrorState
            title={t("plataforma.reportes.queueError")}
            description={errorKindText(reports.error, REPORTS_QUEUE_ERROR_KEYS, t, "errors.reportsQueue.desconocido")}
          />
        )
      ) : !reports.data ? (
        <p className="text-sm text-text-secondary">{t("plataforma.reportes.loading")}</p>
      ) : reports.data.length === 0 ? (
        <EmptyState title={t("plataforma.reportes.empty")} />
      ) : (
        <>
          <Table<ReportRow>
            caption={t("plataforma.reportes.tableCaption")}
            rows={reports.data}
            getRowKey={(report) => report.id}
            columns={[
              {
                key: "reason",
                header: t("plataforma.reportes.colReason"),
                render: (report) => (
                  <Badge tone={report.reason === "self_harm_risk" ? "error" : "neutral"}>
                    {reasonText(report.reason)}
                  </Badge>
                ),
              },
              { key: "target", header: t("plataforma.reportes.colTarget"), render: (report) => report.target_type },
              {
                key: "organization",
                header: t("plataforma.reportes.colOrganization"),
                render: (report) => report.organization_display?.name ?? t("plataforma.reportes.globalScope"),
              },
              {
                key: "status",
                header: t("plataforma.reportes.colStatus"),
                render: (report) => (
                  <span className="flex items-center gap-1">
                    {statusText(report.status)}
                    {report.escalated_at ? <Badge tone="info">{t("plataforma.reportes.escalated")}</Badge> : null}
                  </span>
                ),
              },
              { key: "created_at", header: t("plataforma.reportes.colDate"), render: (report) => formatDate(report.created_at) },
              {
                key: "detail",
                header: <span className="sr-only">{t("common.actions")}</span>,
                render: (report) => (
                  <Link href={`/plataforma/reportes/${report.id}`} className="font-medium text-primary-700 underline">
                    {t("plataforma.reportes.viewDetail")}
                  </Link>
                ),
              },
            ]}
          />

          <p className="text-sm text-text-secondary">
            {t("plataforma.reportes.count", { count: reports.data.length })}
          </p>
        </>
      )}
    </div>
  );
}
