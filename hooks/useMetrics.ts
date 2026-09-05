"use client";

/**
 * `GET /api/panel/{entidad,paraguas,plataforma}/*\/metrics/`
 * (`docs/PANEL.md` §1). Un ámbito, un `orgId` opcional (plataforma no
 * lleva entidad) y un periodo deciden la ruta y la query string; el
 * `group_by` es opcional (sin él, el backend deja `by_place`/
 * `by_weekday_hour`/`series` vacíos, útil para pedir solo `people`/
 * `events`/`attendance`/`communities`).
 *
 * Un 400 (periodo inválido: `since > until` o > 366 días) y un 403 (sin
 * permiso `ver_panel`, o entidad inexistente — el backend no distingue
 * las dos) se traducen a `MetricsError` con un `kind` tipado en vez de
 * dejar escapar el `ApiError` genérico: los componentes de
 * `components/metrics/*` deciden qué mensaje pintar mirando `kind`, no
 * el código HTTP.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { METRICS } from "@/lib/api/endpoints";
import type { MetricsResponse } from "@/lib/api/types";
import type { Period } from "@/lib/metrics/period";

export type MetricsScope = "entidad" | "paraguas" | "plataforma";

export type MetricsGroupBy =
  | "place"
  | "comarca"
  | "province"
  | "organization"
  | "weekday_hour"
  | "month"
  | "year";

export type MetricsErrorKind = "periodo_invalido" | "sin_acceso" | "desconocido";

export class MetricsError extends Error {
  readonly kind: MetricsErrorKind;

  constructor(kind: MetricsErrorKind, message: string) {
    super(message);
    this.name = "MetricsError";
    this.kind = kind;
  }
}

function endpointFor(scope: MetricsScope, orgId?: number | string): string {
  switch (scope) {
    case "entidad":
      if (orgId === undefined) {
        throw new Error("useMetrics: falta orgId para el ámbito 'entidad'");
      }
      return METRICS.ENTIDAD(orgId);
    case "paraguas":
      if (orgId === undefined) {
        throw new Error("useMetrics: falta orgId para el ámbito 'paraguas'");
      }
      return METRICS.PARAGUAS(orgId);
    case "plataforma":
      return METRICS.PLATAFORMA();
  }
}

function buildQuery(period: Period, groupBy?: MetricsGroupBy): string {
  const params = new URLSearchParams({ since: period.since, until: period.until });
  if (groupBy) params.set("group_by", groupBy);
  return params.toString();
}

function toMetricsError(error: unknown): MetricsError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return new MetricsError("periodo_invalido", "El periodo elegido no es válido.");
    }
    if (error.status === 403) {
      return new MetricsError("sin_acceso", "No tienes acceso a estas métricas.");
    }
  }
  return new MetricsError("desconocido", "No se pudieron cargar las métricas.");
}

export function useMetrics(
  scope: MetricsScope,
  orgId: number | string | undefined,
  period: Period,
  groupBy?: MetricsGroupBy,
): UseQueryResult<MetricsResponse, MetricsError> {
  const path = endpointFor(scope, orgId);
  const query = buildQuery(period, groupBy);

  return useQuery<MetricsResponse, MetricsError>({
    queryKey: ["panel-metrics", scope, orgId ?? null, period.since, period.until, groupBy ?? null],
    queryFn: async () => {
      try {
        return await apiFetch<MetricsResponse>(`${path}?${query}`);
      } catch (error) {
        throw toMetricsError(error);
      }
    },
  });
}
