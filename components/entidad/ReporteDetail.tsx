"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useReport } from "@/hooks/useReport";
import { useAssignReport, useEscalateReport, useResolveReport } from "@/hooks/useReportActions";
import type { ReportResolution } from "@/lib/api/types";

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

const RESOLUTION_LABELS: Record<ReportResolution, string> = {
  dismissed: "Descartar",
  warned: "Avisar a la persona",
  content_removed: "Retirar el contenido",
  user_suspended: "Suspender a la persona (3 meses)",
};

/**
 * Detalle de un reporte (tarea W4a, `docs/SEGURIDAD_Y_MODERACION.md` §4):
 * asignarme, resolver con una resolución y una nota, o escalar a
 * plataforma con una nota. Las tres acciones exigen moderación de la
 * entidad (`titular`/`moderador`) — `support` (plataforma) nunca llega a
 * esta página del panel de entidad.
 */
export function ReporteDetail({ reportId, readOnly = false }: ReporteDetailProps) {
  const report = useReport(reportId);
  const assign = useAssignReport();
  const resolve = useResolveReport();
  const escalate = useEscalateReport();

  const [resolution, setResolution] = useState<ReportResolution>("dismissed");
  const [note, setNote] = useState("");
  const [escalateNote, setEscalateNote] = useState("");

  if (report.isError) {
    if (report.error.kind === "sin_acceso") {
      return <EmptyState title="Sin acceso" description="No tienes acceso a este reporte." />;
    }
    return <ErrorState title="No se pudo cargar el reporte" description={report.error.message} />;
  }

  if (!report.data) {
    return <p className="text-sm text-text-secondary">Cargando reporte…</p>;
  }

  const data = report.data;
  const alreadyResolved = data.status === "resolved";

  return (
    <div className="flex flex-col gap-4">
      <Card title="Detalle">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-text-secondary">Motivo</dt>
          <dd className="text-text-base">{data.reason}</dd>
          <dt className="text-text-secondary">Objetivo</dt>
          <dd className="text-text-base">
            {data.target.type} — {data.target.name ?? data.target.title ?? data.target.id}
          </dd>
          <dt className="text-text-secondary">Descripción</dt>
          <dd className="text-text-base">{data.description || "—"}</dd>
          <dt className="text-text-secondary">Estado</dt>
          <dd className="text-text-base">
            <Badge tone={alreadyResolved ? "success" : "info"}>{data.status}</Badge>
          </dd>
          <dt className="text-text-secondary">Asignado a</dt>
          <dd className="text-text-base">{data.assigned_to ?? "Sin asignar"}</dd>
          <dt className="text-text-secondary">Entidad</dt>
          <dd className="text-text-base">{data.organization_display?.name ?? "Global"}</dd>
          {data.escalated_at ? (
            <>
              <dt className="text-text-secondary">Escalado</dt>
              <dd className="text-text-base">
                <Badge tone="info">Escalado a plataforma</Badge>
              </dd>
            </>
          ) : null}
        </dl>
      </Card>

      {readOnly ? null : !data.assigned_to ? (
        <div>
          <Button type="button" disabled={assign.isPending} onClick={() => assign.mutate(reportId)}>
            Asignarme
          </Button>
          {assign.isError ? (
            <p role="alert" className="mt-1 text-sm text-error">
              {assign.error.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {readOnly ? null : !alreadyResolved ? (
        <Card title="Resolver">
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="reporte-resolucion" className="mb-1 block text-sm font-medium text-text-form">
                Resolución
              </label>
              <select
                id="reporte-resolucion"
                value={resolution}
                onChange={(event) => setResolution(event.target.value as ReportResolution)}
                className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
              >
                {(Object.keys(RESOLUTION_LABELS) as ReportResolution[]).map((value) => (
                  <option key={value} value={value}>
                    {RESOLUTION_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reporte-nota" className="mb-1 block text-sm font-medium text-text-form">
                Nota de resolución
              </label>
              <textarea
                id="reporte-nota"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
                rows={3}
              />
            </div>
            <Button
              type="button"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ reportId, resolution, note: note || undefined })}
            >
              Resolver
            </Button>
            {resolve.isError ? (
              <p role="alert" className="text-sm text-error">
                {resolve.error.message}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {readOnly ? null : !alreadyResolved ? (
        <Card title="Escalar a plataforma">
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="reporte-nota-escalado" className="mb-1 block text-sm font-medium text-text-form">
                Nota para plataforma
              </label>
              <textarea
                id="reporte-nota-escalado"
                value={escalateNote}
                onChange={(event) => setEscalateNote(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
                rows={2}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={escalate.isPending}
              onClick={() => escalate.mutate({ reportId, note: escalateNote || undefined })}
            >
              Escalar
            </Button>
            {escalate.isError ? (
              <p role="alert" className="text-sm text-error">
                {escalate.error.message}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
