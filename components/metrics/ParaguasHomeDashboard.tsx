"use client";

/**
 * Inicio del área de administración (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §4.1, fila
 * «Inicio»): responde a «¿cómo está mi territorio?» con dos bloques que
 * son dos lecturas distintas de la misma administración — el
 * **territorio** declarado (`scope_territorio`: todo lo que ocurre en
 * sus municipios) y la **red financiada** (el árbol `parent`/`children`:
 * solo sus entidades hijas). Cada bloque enlaza a su sección, donde
 * está el detalle.
 *
 * **Decisión documentada** (ver el plan de esta tarea): la spec pedía
 * además una tarjeta de «entidades con sede» en el territorio, pero el
 * contrato no tiene ningún agregado para eso —
 * `organizations_based_here` es **por municipio** (§3.2) y sumarlo
 * exigiría una petición por municipio. El bloque de red financiada sí
 * cuenta sus entidades, que es el recuento que el backend sí da
 * (`GET /api/organizations/?parent=`).
 */
import Link from "next/link";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useMetrics, type MetricsErrorKind } from "@/hooks/useMetrics";
import { useOrganizations } from "@/hooks/useOrganizations";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { presetPeriod } from "@/lib/metrics/period";

import { StatCard } from "./StatCard";

const METRICS_ERROR_KEYS: Record<MetricsErrorKind, string> = {
  periodo_invalido: "errors.metrics.periodoInvalido",
  sin_acceso: "errors.metrics.sinAcceso",
  sin_territorio: "errors.metrics.sinTerritorio",
  desconocido: "errors.metrics.desconocido",
};

export interface ParaguasHomeDashboardProps {
  orgId: number | string;
  slug: string;
  orgName: string;
}

export function ParaguasHomeDashboard({ orgId, slug, orgName }: ParaguasHomeDashboardProps) {
  const t = useTranslations();
  // Periodo fijo al mes en curso, sin selector: el Inicio es un vistazo,
  // y las dos secciones que enlaza sí tienen su `PeriodSelector`.
  const period = presetPeriod("mes");

  const territorio = useMetrics("territorio", orgId, period);
  const red = useMetrics("paraguas", orgId, period);
  const children = useOrganizations({ parent: orgId });

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="inicio-territorio-heading" className="flex flex-col gap-3">
        <h2 id="inicio-territorio-heading" className="text-lg font-semibold text-text-base">
          {t("paraguas.inicio.territoryHeading")}
        </h2>
        {territorio.error?.kind === "sin_territorio" ? (
          <EmptyState
            title={errorKindText(
              territorio.error,
              METRICS_ERROR_KEYS,
              t,
              "errors.metrics.sinTerritorio",
            )}
            description={t("paraguas.territorio.noTerritoryHint")}
          />
        ) : territorio.isError ? (
          <ErrorState
            title={t("metrics.dashboard.loadError")}
            description={errorKindText(
              territorio.error,
              METRICS_ERROR_KEYS,
              t,
              "errors.metrics.desconocido",
            )}
          />
        ) : !territorio.data ? (
          <p className="text-sm text-text-secondary">{t("metrics.dashboard.loading")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label={t("metrics.stats.activePeople")}
              value={formatCount(territorio.data.people.active, territorio.data.people.suppressed)}
            />
            <StatCard
              label={t("metrics.stats.eventsHeld")}
              value={formatCount(territorio.data.events.held, false)}
            />
            <StatCard
              label={t("paraguas.territorio.communitiesStat")}
              value={formatCount(
                territorio.data.communities.active,
                territorio.data.communities.suppressed,
              )}
            />
          </div>
        )}
        <Link href={`/paraguas/${slug}/territorio`} className="text-sm text-primary-700 underline">
          {t("paraguas.inicio.territoryLink")}
        </Link>
      </section>

      <section aria-labelledby="inicio-red-heading" className="flex flex-col gap-3">
        <h2 id="inicio-red-heading" className="text-lg font-semibold text-text-base">
          {t("paraguas.inicio.networkHeading")}
        </h2>
        {red.isError ? (
          <ErrorState
            title={t("metrics.dashboard.loadError")}
            description={errorKindText(red.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
          />
        ) : !red.data ? (
          <p className="text-sm text-text-secondary">
            {t("metrics.dashboard.loadingWithName", { orgName })}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label={t("paraguas.inicio.fundedEntities")}
              // I3 de la revisión final de rama: un fallo del listado
              // (403, red, 5xx) se leía como «—», indistinguible de «no
              // financia ninguna entidad» (regla B15, `CLAUDE.md`).
              value={
                children.isError
                  ? t("plataforma.inicio.unavailable")
                  : formatCount(children.data?.count ?? null, false)
              }
            />
            <StatCard
              label={t("metrics.stats.eventsHeld")}
              value={formatCount(red.data.events.held, false)}
            />
            <StatCard
              label={t("metrics.stats.attendanceRate")}
              value={formatPct(red.data.attendance.rate, red.data.attendance.suppressed)}
            />
          </div>
        )}
        <Link
          href={`/paraguas/${slug}/red-financiada`}
          className="text-sm text-primary-700 underline"
        >
          {t("paraguas.inicio.networkLink")}
        </Link>
      </section>
    </div>
  );
}
