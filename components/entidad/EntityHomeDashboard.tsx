"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatCard } from "@/components/metrics/StatCard";
import { useEntityHome } from "@/hooks/useEntityHome";
import { formatCount, formatPct } from "@/lib/metrics/format";

export interface EntityHomeDashboardProps {
  orgId: number | string;
  slug: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Inicio de la entidad (tarea W3): actividades de hoy con
 * inscritos/plazas/responsable, avisos de ayuda y reportes pendientes
 * (con enlace a Guardia/Reportes) y las métricas del mes
 * (`docs/PANEL.md` §1, misma regla de supresión `<5` que la vista del
 * financiador).
 */
export function EntityHomeDashboard({ orgId, slug }: EntityHomeDashboardProps) {
  const { today, pendingReports, pendingHelpRequests, metrics } = useEntityHome(orgId);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="actividades-hoy-heading">
        <h2 id="actividades-hoy-heading" className="mb-2 text-lg font-semibold text-text-base">
          Actividades de hoy
        </h2>
        {today.isError ? (
          <ErrorState title="No se pudieron cargar las actividades de hoy" description={today.error.message} />
        ) : !today.data ? (
          <p className="text-sm text-text-secondary">Cargando actividades…</p>
        ) : today.data.length === 0 ? (
          <EmptyState title="Sin actividades hoy" />
        ) : (
          <ul className="flex flex-col gap-2">
            {today.data.map((event) => (
              <li key={event.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-text-base">{event.title}</p>
                      <p className="text-sm text-text-secondary">
                        {formatTime(event.starts_at)}
                        {event.organizer ? ` · ${event.organizer.public_name}` : ""}
                      </p>
                    </div>
                    <Badge tone="info">
                      {event.registered} inscritos
                      {event.capacity !== null ? ` / ${event.capacity} plazas` : ""}
                    </Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="avisos-heading" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h2 id="avisos-heading" className="sr-only">
          Avisos pendientes
        </h2>
        {pendingHelpRequests.data !== null && pendingHelpRequests.data !== undefined ? (
          <Card title="Solicitudes de ayuda pendientes">
            <p className="text-2xl font-semibold text-text-base">{pendingHelpRequests.data}</p>
            <Link href={`/entidad/${slug}/guardia`} className="text-sm font-medium text-primary-700 underline">
              Ir a Guardia
            </Link>
          </Card>
        ) : pendingHelpRequests.isError ? (
          <p className="text-sm text-error">No se pudieron cargar las solicitudes de ayuda.</p>
        ) : null}

        {pendingReports.data !== null && pendingReports.data !== undefined ? (
          <Card title="Reportes pendientes">
            <p className="text-2xl font-semibold text-text-base">{pendingReports.data}</p>
            <Link href={`/entidad/${slug}/reportes`} className="text-sm font-medium text-primary-700 underline">
              Ir a Reportes
            </Link>
          </Card>
        ) : pendingReports.isError ? (
          <p className="text-sm text-error">No se pudieron cargar los reportes.</p>
        ) : null}
      </section>

      <section aria-labelledby="metricas-mes-heading">
        <h2 id="metricas-mes-heading" className="mb-2 text-lg font-semibold text-text-base">
          Este mes
        </h2>
        {metrics.isError ? (
          <ErrorState title="No se pudieron cargar las métricas" description={metrics.error.message} />
        ) : !metrics.data ? (
          <p className="text-sm text-text-secondary">Cargando métricas…</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Personas activas"
              value={formatCount(metrics.data.people.active, metrics.data.people.suppressed)}
            />
            <StatCard
              label="Altas"
              value={formatCount(metrics.data.people.new, metrics.data.people.suppressed)}
            />
            <StatCard
              label="Actividades celebradas"
              value={formatCount(metrics.data.events.held, false)}
            />
            <StatCard
              label="Actividades canceladas"
              value={formatCount(metrics.data.events.cancelled, false)}
            />
            <StatCard
              label="Asistencia"
              value={formatPct(metrics.data.attendance.rate, metrics.data.attendance.suppressed)}
            />
            <StatCard
              label="No-shows"
              value={formatCount(metrics.data.attendance.no_show, metrics.data.attendance.suppressed)}
            />
            <StatCard
              label="Comunidades activas"
              value={formatCount(metrics.data.communities.active, false)}
            />
            <StatCard
              label="Personas en comunidades"
              value={formatCount(metrics.data.communities.members, metrics.data.communities.suppressed)}
            />
          </div>
        )}
      </section>
    </div>
  );
}
