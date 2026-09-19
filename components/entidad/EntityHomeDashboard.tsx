"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatCard } from "@/components/metrics/StatCard";
import { useEntityHome } from "@/hooks/useEntityHome";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatCount, formatPct } from "@/lib/metrics/format";

export interface EntityHomeDashboardProps {
  orgId: number | string;
  slug: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

const ENTITY_EVENTS_ERROR_KEYS = {
  periodo_invalido: "errors.entityEvents.periodoInvalido",
  sin_acceso: "errors.entityEvents.sinAcceso",
  desconocido: "errors.entityEvents.desconocido",
} as const;

// `useEntityHome` reutiliza `useMetrics` (tarea W3) tal cual — mismo mapa
// de claves que `{Paraguas,Plataforma}MetricsDashboard.tsx` (tarea 5 de
// i18n), sin duplicar el catálogo.
const METRICS_ERROR_KEYS = {
  periodo_invalido: "errors.metrics.periodoInvalido",
  sin_acceso: "errors.metrics.sinAcceso",
  desconocido: "errors.metrics.desconocido",
} as const;

/**
 * Inicio de la entidad (tarea W3): actividades de hoy con
 * inscritos/plazas/responsable, avisos de ayuda y reportes pendientes
 * (con enlace a Guardia/Reportes) y las métricas del mes
 * (`docs/PANEL.md` §1, misma regla de supresión `<5` que la vista del
 * financiador).
 */
export function EntityHomeDashboard({ orgId, slug }: EntityHomeDashboardProps) {
  const { today, pendingReports, pendingHelpRequests, metrics, activePrograms } = useEntityHome(orgId);
  const t = useTranslations("entidad.inicio");
  const tErrors = useTranslations();

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="actividades-hoy-heading">
        <h2 id="actividades-hoy-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("todayHeading")}
        </h2>
        {today.isError ? (
          <ErrorState
            title={t("todayErrorTitle")}
            description={errorKindText(
              today.error,
              ENTITY_EVENTS_ERROR_KEYS,
              tErrors,
              "errors.entityEvents.desconocido",
            )}
          />
        ) : !today.data ? (
          <p className="text-sm text-text-secondary">{t("loadingToday")}</p>
        ) : today.data.length === 0 ? (
          <EmptyState title={t("noEventsToday")} />
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
                      {t("eventRegistered", { count: event.registered })}
                      {event.capacity !== null ? ` / ${t("eventCapacity", { count: event.capacity })}` : ""}
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
          {t("pendingAlertsHeading")}
        </h2>
        {pendingHelpRequests.data !== null && pendingHelpRequests.data !== undefined ? (
          <Card title={t("pendingHelpRequests")}>
            <p className="text-2xl font-semibold text-text-base">{pendingHelpRequests.data}</p>
            <Link href={`/entidad/${slug}/guardia`} className="text-sm font-medium text-primary-700 underline">
              {t("goToGuardia")}
            </Link>
          </Card>
        ) : pendingHelpRequests.isError ? (
          <p className="text-sm text-error">{t("helpRequestsError")}</p>
        ) : null}

        {pendingReports.data !== null && pendingReports.data !== undefined ? (
          <Card title={t("pendingReports")}>
            <p className="text-2xl font-semibold text-text-base">{pendingReports.data}</p>
            <Link href={`/entidad/${slug}/reportes`} className="text-sm font-medium text-primary-700 underline">
              {t("goToReportes")}
            </Link>
          </Card>
        ) : pendingReports.isError ? (
          <p className="text-sm text-error">{t("reportsError")}</p>
        ) : null}
      </section>

      <section aria-labelledby="programas-heading">
        <h2 id="programas-heading" className="sr-only">
          {t("programsHeading")}
        </h2>
        {activePrograms.data ? (
          <Card title={t("activePrograms")}>
            <p className="text-2xl font-semibold text-text-base">
              {activePrograms.data.filter((program) => program.status === "active").length}
            </p>
            <Link
              href={`/entidad/${slug}/programas`}
              className="text-sm font-medium text-primary-700 underline"
            >
              {t("goToProgramas")}
            </Link>
          </Card>
        ) : activePrograms.isError ? (
          <p className="text-sm text-error">{t("programsError")}</p>
        ) : null}
      </section>

      <section aria-labelledby="metricas-mes-heading">
        <h2 id="metricas-mes-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("monthHeading")}
        </h2>
        {metrics.isError ? (
          <ErrorState
            title={t("metricsErrorTitle")}
            description={errorKindText(metrics.error, METRICS_ERROR_KEYS, tErrors, "errors.metrics.desconocido")}
          />
        ) : !metrics.data ? (
          <p className="text-sm text-text-secondary">{t("loadingMetrics")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label={t("statActivePeople")}
              value={formatCount(metrics.data.people.active, metrics.data.people.suppressed)}
            />
            <StatCard
              label={t("statNew")}
              value={formatCount(metrics.data.people.new, metrics.data.people.suppressed)}
            />
            <StatCard
              label={t("statEventsHeld")}
              value={formatCount(metrics.data.events.held, false)}
            />
            <StatCard
              label={t("statEventsCancelled")}
              value={formatCount(metrics.data.events.cancelled, false)}
            />
            <StatCard
              label={t("statAttendance")}
              value={formatPct(metrics.data.attendance.rate, metrics.data.attendance.suppressed)}
            />
            <StatCard
              label={t("statNoShows")}
              value={formatCount(metrics.data.attendance.no_show, metrics.data.attendance.suppressed)}
            />
            <StatCard
              label={t("statActiveCommunities")}
              value={formatCount(metrics.data.communities.active, false)}
            />
            <StatCard
              label={t("statCommunityMembers")}
              value={formatCount(metrics.data.communities.members, metrics.data.communities.suppressed)}
            />
          </div>
        )}
      </section>
    </div>
  );
}
