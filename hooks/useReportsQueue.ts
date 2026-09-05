"use client";

/**
 * `GET /api/safety/reports/queue/?organization=<id>&status=`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §4): cola de reportes de la entidad
 * (`titular`/`moderador`; `dinamizador`/`analista` no llegan a esta
 * página — `entidadMenuFor` ya la excluye de su menú, y la propia página
 * comprueba el rol). Paginada de verdad (`PageNumberPagination`).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { PaginatedReportList } from "@/lib/api/types";

export type ReportsQueueErrorKind = "sin_acceso" | "desconocido";

export class ReportsQueueError extends Error {
  readonly kind: ReportsQueueErrorKind;

  constructor(kind: ReportsQueueErrorKind, message: string) {
    super(message);
    this.name = "ReportsQueueError";
    this.kind = kind;
  }
}

export interface ReportsQueueFilters {
  status?: "pending" | "in_review" | "resolved";
  page?: number;
}

function buildQuery(orgId: number | string, filters: ReportsQueueFilters): string {
  const params = new URLSearchParams({ organization: String(orgId) });
  if (filters.status) params.set("status", filters.status);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

export function useReportsQueue(
  orgId: number | string,
  filters: ReportsQueueFilters = {},
): UseQueryResult<PaginatedReportList, ReportsQueueError> {
  const query = buildQuery(orgId, filters);

  return useQuery<PaginatedReportList, ReportsQueueError>({
    queryKey: ["panel-reports-queue", orgId, query],
    queryFn: async () => {
      try {
        return await apiFetch<PaginatedReportList>(`${SAFETY.REPORTS_QUEUE()}?${query}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new ReportsQueueError("sin_acceso", "No tienes acceso a la cola de reportes.");
        }
        throw new ReportsQueueError("desconocido", "No se pudo cargar la cola de reportes.");
      }
    },
  });
}
