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
 */
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useReportsQueue, type ReportsQueueFilters } from "@/hooks/useReportsQueue";
import type { ReportRow } from "@/lib/api/types";
import { reasonLabel, statusLabel } from "@/lib/reports/labels";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES");
}

export function ReportesQueuePlataforma() {
  const [status, setStatus] = useState<ReportsQueueFilters["status"] | "">("pending");

  const reports = useReportsQueue(undefined, { status: status || undefined });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="plataforma-reportes-status" className="mb-1 block text-sm font-medium text-text-form">
          Estado
        </label>
        <select
          id="plataforma-reportes-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ReportsQueueFilters["status"] | "");
          }}
          className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        >
          <option value="">Todos</option>
          <option value="pending">Pendiente</option>
          <option value="in_review">En revisión</option>
          <option value="resolved">Resuelto</option>
        </select>
      </div>

      {reports.isError ? (
        reports.error.kind === "sin_acceso" ? (
          <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a la cola de reportes." />
        ) : (
          <ErrorState title="No se pudo cargar la cola de reportes" description={reports.error.message} />
        )
      ) : !reports.data ? (
        <p className="text-sm text-text-secondary">Cargando reportes…</p>
      ) : reports.data.length === 0 ? (
        <EmptyState title="Sin reportes con este filtro" />
      ) : (
        <>
          <Table<ReportRow>
            caption="Reportes de plataforma"
            rows={reports.data}
            getRowKey={(report) => report.id}
            columns={[
              {
                key: "reason",
                header: "Motivo",
                render: (report) => (
                  <Badge tone={report.reason === "self_harm_risk" ? "error" : "neutral"}>
                    {reasonLabel(report.reason)}
                  </Badge>
                ),
              },
              { key: "target", header: "Objetivo", render: (report) => report.target_type },
              {
                key: "organization",
                header: "Entidad",
                render: (report) => report.organization_display?.name ?? "Global",
              },
              {
                key: "status",
                header: "Estado",
                render: (report) => (
                  <span className="flex items-center gap-1">
                    {statusLabel(report.status)}
                    {report.escalated_at ? <Badge tone="info">Escalado</Badge> : null}
                  </span>
                ),
              },
              { key: "created_at", header: "Fecha", render: (report) => formatDate(report.created_at) },
              {
                key: "detail",
                header: <span className="sr-only">Acciones</span>,
                render: (report) => (
                  <Link href={`/plataforma/reportes/${report.id}`} className="font-medium text-primary-700 underline">
                    Ver detalle
                  </Link>
                ),
              },
            ]}
          />

          <p className="text-sm text-text-secondary">{reports.data.length} reportes</p>
        </>
      )}
    </div>
  );
}
