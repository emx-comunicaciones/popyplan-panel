"use client";

/**
 * `GET /api/panel/{paraguas,plataforma}/compare/?since&until&group_by`
 * (`docs/PANEL.md` §11, tarea B2): compara el periodo pedido con el
 * inmediatamente anterior de igual longitud, desglosado por ámbito. A
 * diferencia de `useMetrics` (§1, `group_by` opcional), aquí es
 * **obligatorio** — quien llama siempre debe pasar uno de los valores
 * permitidos para ese ámbito (`comarca`/`organization`/`place` en
 * paraguas; `comarca`/`province`/`organization` en plataforma); sin él,
 * o con uno fuera de ese conjunto, el backend responde 400 con
 * `{"group_by": "Desglose obligatorio: …"}`.
 *
 * Un 400 (grupo o periodo inválidos) y un 403 (sin `ver_panel` sobre la
 * propia paraguas, o sin rol de plataforma) se traducen a `CompareError`
 * con un `kind` tipado, igual que `useMetrics`/`MetricsError`.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { METRICS } from "@/lib/api/endpoints";
import type { CompareResponse } from "@/lib/api/types";
import type { Period } from "@/lib/metrics/period";

export type CompareScope = "paraguas" | "plataforma";

export type CompareGroupBy = "comarca" | "organization" | "place" | "province";

export type CompareErrorKind = "periodo_invalido" | "sin_acceso" | "desconocido";

export class CompareError extends Error {
  readonly kind: CompareErrorKind;

  constructor(kind: CompareErrorKind, message: string) {
    super(message);
    this.name = "CompareError";
    this.kind = kind;
  }
}

function endpointFor(scope: CompareScope, orgId?: number | string): string {
  switch (scope) {
    case "paraguas":
      if (orgId === undefined) {
        throw new Error("useCompare: falta orgId para el ámbito 'paraguas'");
      }
      return METRICS.COMPARE_PARAGUAS(orgId);
    case "plataforma":
      return METRICS.COMPARE_PLATAFORMA();
  }
}

function buildQuery(period: Period, groupBy: CompareGroupBy): string {
  const params = new URLSearchParams({
    since: period.since,
    until: period.until,
    group_by: groupBy,
  });
  return params.toString();
}

function toCompareError(error: unknown): CompareError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return new CompareError(
        "periodo_invalido",
        "El periodo o el desglose elegidos no son válidos.",
      );
    }
    if (error.status === 403) {
      return new CompareError("sin_acceso", "No tienes acceso a esta comparativa.");
    }
  }
  return new CompareError("desconocido", "No se pudo cargar la comparativa.");
}

export function useCompare(
  scope: CompareScope,
  orgId: number | string | undefined,
  period: Period,
  groupBy: CompareGroupBy,
): UseQueryResult<CompareResponse, CompareError> {
  const path = endpointFor(scope, orgId);
  const query = buildQuery(period, groupBy);

  return useQuery<CompareResponse, CompareError>({
    queryKey: ["panel-compare", scope, orgId ?? null, period.since, period.until, groupBy],
    queryFn: async () => {
      try {
        return await apiFetch<CompareResponse>(`${path}?${query}`);
      } catch (error) {
        throw toCompareError(error);
      }
    },
  });
}
