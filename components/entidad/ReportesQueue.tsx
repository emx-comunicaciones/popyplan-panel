"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useReportsQueue, type ReportsQueueFilters } from "@/hooks/useReportsQueue";
import { reasonLabel, statusLabel } from "@/lib/reports/labels";

export interface ReportesQueueProps {
  orgId: number | string;
  slug: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES");
}

/**
 * Cola de reportes de la entidad (tarea W4a,
 * `docs/SEGURIDAD_Y_MODERACION.md` §4). Un reporte contra la propia
 * entidad nunca aparece aquí (va siempre a la cola de plataforma): el
 * backend ya lo filtra, esta tabla solo pinta lo que llega.
 */
export function ReportesQueue({ orgId, slug }: ReportesQueueProps) {
  const [status, setStatus] = useState<ReportsQueueFilters["status"] | "">("pending");

  const reports = useReportsQueue(orgId, { status: status || undefined });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="reportes-status" className="mb-1 block text-sm font-medium text-text-form">
          Estado
        </label>
        <select
          id="reportes-status"
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
        <ErrorState title="No se pudo cargar la cola de reportes" description={reports.error.message} />
      ) : !reports.data ? (
        <p className="text-sm text-text-secondary">Cargando reportes…</p>
      ) : reports.data.length === 0 ? (
        <EmptyState title="Sin reportes con este filtro" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Reportes de la entidad</caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className="px-3 py-2 font-semibold">Motivo</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Objetivo</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Estado</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Fecha</th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.data.map((report) => (
                  <tr key={report.id} className="border-b border-border-light">
                    <td className="px-3 py-2 text-text-base">
                      <Badge tone={report.reason === "self_harm_risk" ? "error" : "neutral"}>
                        {reasonLabel(report.reason)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-text-base">{report.target_type}</td>
                    <td className="px-3 py-2 text-text-base">
                      {statusLabel(report.status)}
                    </td>
                    <td className="px-3 py-2 text-text-base">{formatDate(report.created_at)}</td>
                    <td className="px-3 py-2 text-text-base">
                      <Link
                        href={`/entidad/${slug}/reportes/${report.id}`}
                        className="font-medium text-primary-700 underline"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-text-secondary">{reports.data.length} reportes</p>
        </>
      )}
    </div>
  );
}
