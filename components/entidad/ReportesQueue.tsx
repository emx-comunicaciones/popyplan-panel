"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useReportsQueue, type ReportsQueueErrorKind, type ReportsQueueFilters } from "@/hooks/useReportsQueue";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeFor, activeLanguage } from "@/lib/i18n/locale";
import { reasonLabelKey, statusLabelKey } from "@/lib/reports/labels";

export interface ReportesQueueProps {
  orgId: number | string;
  slug: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(localeFor(activeLanguage()));
}

const REPORTS_QUEUE_ERROR_KEYS: Record<ReportsQueueErrorKind, string> = {
  sin_acceso: "errors.reportsQueue.sinAcceso",
  desconocido: "errors.reportsQueue.desconocido",
};

/**
 * Cola de reportes de la entidad (tarea W4a,
 * `docs/SEGURIDAD_Y_MODERACION.md` §4). Un reporte contra la propia
 * entidad nunca aparece aquí (va siempre a la cola de plataforma): el
 * backend ya lo filtra, esta tabla solo pinta lo que llega.
 */
export function ReportesQueue({ orgId, slug }: ReportesQueueProps) {
  const t = useTranslations();
  const [status, setStatus] = useState<ReportsQueueFilters["status"] | "">("pending");

  const reports = useReportsQueue(orgId, { status: status || undefined });

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
        <label htmlFor="reportes-status" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.reportes.statusLabel")}
        </label>
        <select
          id="reportes-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ReportsQueueFilters["status"] | "");
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        >
          <option value="">{t("entidad.reportes.statusAll")}</option>
          <option value="pending">{t("reports.status.pending")}</option>
          <option value="in_review">{t("reports.status.inReview")}</option>
          <option value="resolved">{t("reports.status.resolved")}</option>
        </select>
      </div>

      {reports.isError ? (
        <ErrorState
          title={t("entidad.reportes.queueError")}
          description={errorKindText(
            reports.error,
            REPORTS_QUEUE_ERROR_KEYS,
            t,
            "errors.reportsQueue.desconocido",
          )}
        />
      ) : !reports.data ? (
        <p className="text-sm text-text-secondary">{t("entidad.reportes.loading")}</p>
      ) : reports.data.length === 0 ? (
        <EmptyState title={t("entidad.reportes.empty")} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("entidad.reportes.tableCaption")}</caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className="px-3 py-1.5 font-semibold">
                    {t("entidad.reportes.colReason")}
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">
                    {t("entidad.reportes.colTarget")}
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">
                    {t("entidad.reportes.colStatus")}
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">
                    {t("entidad.reportes.colDate")}
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">
                    <span className="sr-only">{t("common.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.data.map((report) => (
                  <tr key={report.id} className="border-b border-border-light">
                    <td className="px-3 py-1.5 text-text-base">
                      <Badge tone={report.reason === "self_harm_risk" ? "error" : "neutral"}>
                        {reasonText(report.reason)}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-text-base">{report.target_type}</td>
                    <td className="px-3 py-1.5 text-text-base">{statusText(report.status)}</td>
                    <td className="px-3 py-1.5 text-text-base">{formatDate(report.created_at)}</td>
                    <td className="px-3 py-1.5 text-text-base">
                      <Link
                        href={`/entidad/${slug}/reportes/${report.id}`}
                        className="font-medium text-primary-700 underline"
                      >
                        {t("entidad.reportes.viewDetail")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-text-secondary">
            {t("entidad.reportes.count", { count: reports.data.length })}
          </p>
        </>
      )}
    </div>
  );
}
