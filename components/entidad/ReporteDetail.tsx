"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useReport, type ReportErrorKind } from "@/hooks/useReport";
import {
  useAssignReport,
  useEscalateReport,
  useResolveReport,
  type ReportActionErrorKind,
} from "@/hooks/useReportActions";
import type { ReportResolution } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { reasonLabelKey, statusLabelKey } from "@/lib/reports/labels";

const REPORT_ERROR_KEYS: Record<ReportErrorKind, string> = {
  sin_acceso: "errors.report.sinAcceso",
  no_encontrado: "errors.report.noEncontrado",
  desconocido: "errors.report.desconocido",
};

// `toReportActionError` (`hooks/useReportActions.ts`) usa el mismo texto
// de repuesto para 400 sin `detail` (`invalido`) y para cualquier otro
// fallo (`desconocido`) — solo `sin_permiso` (403) tiene mensaje propio,
// compartido por las tres acciones.
const ASSIGN_REPORT_ERROR_KEYS: Record<ReportActionErrorKind, string> = {
  invalido: "errors.reportAction.desconocidoAsignar",
  sin_permiso: "errors.reportAction.sinPermiso",
  desconocido: "errors.reportAction.desconocidoAsignar",
};

const RESOLVE_REPORT_ERROR_KEYS: Record<ReportActionErrorKind, string> = {
  invalido: "errors.reportAction.desconocidoResolver",
  sin_permiso: "errors.reportAction.sinPermiso",
  desconocido: "errors.reportAction.desconocidoResolver",
};

const ESCALATE_REPORT_ERROR_KEYS: Record<ReportActionErrorKind, string> = {
  invalido: "errors.reportAction.desconocidoEscalar",
  sin_permiso: "errors.reportAction.sinPermiso",
  desconocido: "errors.reportAction.desconocidoEscalar",
};

export interface ReporteDetailProps {
  reportId: string;
  /**
   * Tarea W5: `support` (plataforma) solo lee la cola/el detalle
   * (`safety/services/reports.py::can_view` lo admite, `can_act` no) —
   * con `readOnly`, se oculta asignarme/resolver/escalar y solo se pinta
   * la ficha. El panel de entidad nunca lo pasa (`support` no llega a
   * esa página), así que su comportamiento no cambia.
   */
  readOnly?: boolean;
}

const RESOLUTION_LABEL_KEYS: Record<ReportResolution, string> = {
  dismissed: "reports.resolution.dismissed",
  warned: "reports.resolution.warned",
  content_removed: "reports.resolution.contentRemoved",
  user_suspended: "reports.resolution.userSuspended",
};

/**
 * Detalle de un reporte (tarea W4a, `docs/SEGURIDAD_Y_MODERACION.md` §4):
 * asignarme, resolver con una resolución y una nota, o escalar a
 * plataforma con una nota. Las tres acciones exigen moderación de la
 * entidad (`titular`/`moderador`) — `support` (plataforma) nunca llega a
 * esta página del panel de entidad.
 */
export function ReporteDetail({ reportId, readOnly = false }: ReporteDetailProps) {
  const t = useTranslations();
  const report = useReport(reportId);
  const assign = useAssignReport();
  const resolve = useResolveReport();
  const escalate = useEscalateReport();

  const [resolution, setResolution] = useState<ReportResolution>("dismissed");
  const [note, setNote] = useState("");
  const [escalateNote, setEscalateNote] = useState("");

  if (report.isError) {
    if (report.error.kind === "sin_acceso") {
      return (
        <EmptyState
          title={t("common.noAccess")}
          description={t("entidad.reporteDetalle.noAccessDescription")}
        />
      );
    }
    return (
      <ErrorState
        title={t("entidad.reporteDetalle.loadError")}
        description={errorKindText(report.error, REPORT_ERROR_KEYS, t, "errors.report.desconocido")}
      />
    );
  }

  if (!report.data) {
    return <p className="text-sm text-text-secondary">{t("entidad.reporteDetalle.loading")}</p>;
  }

  const data = report.data;
  const alreadyResolved = data.status === "resolved";
  const reasonKey = reasonLabelKey(data.reason);
  const statusKey = statusLabelKey(data.status);

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("entidad.reporteDetalle.detailTitle")}>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-text-secondary">{t("entidad.reporteDetalle.reason")}</dt>
          <dd className="text-text-base">{reasonKey ? t(reasonKey) : data.reason}</dd>
          <dt className="text-text-secondary">{t("entidad.reporteDetalle.target")}</dt>
          <dd className="text-text-base">
            {data.target.type} — {data.target.name ?? data.target.title ?? data.target.id}
          </dd>
          <dt className="text-text-secondary">{t("entidad.reporteDetalle.description")}</dt>
          <dd className="text-text-base">{data.description || "—"}</dd>
          <dt className="text-text-secondary">{t("entidad.reporteDetalle.status")}</dt>
          <dd className="text-text-base">
            <Badge tone={alreadyResolved ? "success" : "info"}>
              {statusKey ? t(statusKey) : data.status}
            </Badge>
          </dd>
          <dt className="text-text-secondary">{t("entidad.reporteDetalle.assignedTo")}</dt>
          {/*
            `ReportDetail.assigned_to` es un id de cuenta suelto
            (`number | null`), sin nombre ni `*_display` en el contrato:
            el panel nunca pinta ids de cuenta (invariante 1/9), así que
            solo se dice si está asignado o no.
          */}
          <dd className="text-text-base">
            {data.assigned_to
              ? t("entidad.reporteDetalle.assignedToSomeone")
              : t("entidad.reporteDetalle.unassigned")}
          </dd>
          <dt className="text-text-secondary">{t("entidad.reporteDetalle.organization")}</dt>
          <dd className="text-text-base">
            {data.organization_display?.name ?? t("entidad.reporteDetalle.organizationGlobal")}
          </dd>
          {data.escalated_at ? (
            <>
              <dt className="text-text-secondary">{t("entidad.reporteDetalle.escalated")}</dt>
              <dd className="text-text-base">
                <Badge tone="info">{t("entidad.reporteDetalle.escalatedBadge")}</Badge>
              </dd>
            </>
          ) : null}
        </dl>
      </Card>

      {readOnly ? null : !data.assigned_to ? (
        <div>
          <Button type="button" disabled={assign.isPending} onClick={() => assign.mutate(reportId)}>
            {t("entidad.reporteDetalle.assignToMe")}
          </Button>
          {assign.isError ? (
            <p role="alert" className="mt-1 text-sm text-error">
              {errorKindText(assign.error, ASSIGN_REPORT_ERROR_KEYS, t, "errors.reportAction.desconocidoAsignar")}
            </p>
          ) : null}
        </div>
      ) : null}

      {readOnly ? null : !alreadyResolved ? (
        <Card title={t("entidad.reporteDetalle.resolveTitle")}>
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="reporte-resolucion" className="mb-1 block text-sm font-medium text-text-form">
                {t("entidad.reporteDetalle.resolutionLabel")}
              </label>
              <select
                id="reporte-resolucion"
                value={resolution}
                onChange={(event) => setResolution(event.target.value as ReportResolution)}
                className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
              >
                {(Object.keys(RESOLUTION_LABEL_KEYS) as ReportResolution[]).map((value) => (
                  <option key={value} value={value}>
                    {t(RESOLUTION_LABEL_KEYS[value])}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reporte-nota" className="mb-1 block text-sm font-medium text-text-form">
                {t("entidad.reporteDetalle.resolutionNoteLabel")}
              </label>
              <textarea
                id="reporte-nota"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
                rows={3}
              />
            </div>
            <Button
              type="button"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ reportId, resolution, note: note || undefined })}
            >
              {t("entidad.reporteDetalle.resolve")}
            </Button>
            {resolve.isError ? (
              <p role="alert" className="text-sm text-error">
                {errorKindText(resolve.error, RESOLVE_REPORT_ERROR_KEYS, t, "errors.reportAction.desconocidoResolver")}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {readOnly ? null : !alreadyResolved ? (
        <Card title={t("entidad.reporteDetalle.escalateTitle")}>
          <div className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="reporte-nota-escalado"
                className="mb-1 block text-sm font-medium text-text-form"
              >
                {t("entidad.reporteDetalle.escalateNoteLabel")}
              </label>
              <textarea
                id="reporte-nota-escalado"
                value={escalateNote}
                onChange={(event) => setEscalateNote(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
                rows={2}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={escalate.isPending}
              onClick={() => escalate.mutate({ reportId, note: escalateNote || undefined })}
            >
              {t("entidad.reporteDetalle.escalate")}
            </Button>
            {escalate.isError ? (
              <p role="alert" className="text-sm text-error">
                {errorKindText(escalate.error, ESCALATE_REPORT_ERROR_KEYS, t, "errors.reportAction.desconocidoEscalar")}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
