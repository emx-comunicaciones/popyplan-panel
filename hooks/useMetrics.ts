"use client";

/**
 * `GET /api/panel/{entidad,paraguas,plataforma}/*\/metrics/`
 * (`docs/PANEL.md` §1). Un ámbito, un `orgId` opcional (plataforma no
 * lleva entidad) y un periodo deciden la ruta y la query string; el
 * `group_by` es opcional (sin él, el backend deja `by_place`/
 * `by_weekday_hour`/`series` vacíos, útil para pedir solo `people`/
 * `events`/`attendance`/`communities`).
 *
 * Un 400 (periodo inválido: `since > until` o > 1461 días) y un 403 (sin
 * permiso `ver_panel`, o entidad inexistente — el backend no distingue
 * las dos) se traducen a `MetricsError` con un `kind` tipado en vez de
 * dejar escapar el `ApiError` genérico: los componentes de
 * `components/metrics/*` deciden qué mensaje pintar mirando `kind`, no
 * el código HTTP.
 *
 * El ámbito `territorio` (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §3.1) es el único
 * que además puede responder **409**: una administración sin territorio
 * declarado, que no es un fallo del panel sino una configuración que
 * falta, así que se traduce a su propio `kind` (`sin_territorio`) en vez
 * de a `sin_acceso`. El `detail` se conserva literal porque ya viene
 * traducido por `Accept-Language`.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { METRICS } from "@/lib/api/endpoints";
import type { MetricsResponse } from "@/lib/api/types";
import type { Period } from "@/lib/metrics/period";

export type MetricsScope = "entidad" | "paraguas" | "plataforma" | "territorio";

export type MetricsGroupBy =
  | "place"
  | "comarca"
  | "province"
  | "organization"
  | "weekday_hour"
  | "month"
  | "year";

export type MetricsErrorKind =
  | "periodo_invalido"
  | "sin_acceso"
  | "sin_territorio"
  | "desconocido";

export class MetricsError extends Error {
  readonly kind: MetricsErrorKind;
  /**
   * Texto verbatim del backend, cuando lo hay (tarea 5 de i18n, mismo
   * patrón que el resto de errores tipados del panel): `toMetricsError`
   * no lo rellena hoy (los tres mensajes son siempre fijos, no hay
   * `detailOf` que llamar), pero el campo existe para que
   * `lib/i18n/errorKindText.ts` sepa distinguir un mensaje real del
   * backend de la traducción genérica por `kind` si algún día lo hay.
   */
  readonly detail?: string;

  constructor(kind: MetricsErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "MetricsError";
    this.kind = kind;
    this.detail = detail;
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
    case "territorio":
      if (orgId === undefined) {
        throw new Error("useMetrics: falta orgId para el ámbito 'territorio'");
      }
      return METRICS.TERRITORIO(orgId);
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
    if (error.status === 409) {
      // Solo el ámbito `territorio` responde 409 (spec §3.1): una
      // administración sin territorio declarado, que no es un fallo sino
      // una configuración que falta.
      const detail = detailOf(error);
      return new MetricsError(
        "sin_territorio",
        detail ?? "Esta administración no tiene territorio declarado.",
        detail,
      );
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
    // `String(orgId)` (M11 de la revisión final de rama): sin normalizar,
    // el mismo periodo del mismo ámbito se cachea dos veces si una
    // pantalla pasa un `orgId` number y otra el string del parámetro de
    // ruta — mismo patrón que ya siguen `useOrganization`/`useProgram`.
    queryKey: [
      "panel-metrics",
      scope,
      orgId === undefined ? null : String(orgId),
      period.since,
      period.until,
      groupBy ?? null,
    ],
    queryFn: async () => {
      try {
        return await apiFetch<MetricsResponse>(`${path}?${query}`);
      } catch (error) {
        throw toMetricsError(error);
      }
    },
  });
}
