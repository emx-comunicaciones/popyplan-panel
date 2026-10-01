"use client";

/**
 * `GET /api/safety/reports/queue/?organization=<id>&status=`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §4): cola de reportes de la entidad
 * (`titular`/`moderador`; `dinamizador`/`analista` no llegan a esta
 * página — `entidadMenuFor` ya la excluye de su menú, y la propia página
 * comprueba el rol).
 *
 * Tarea W5 (panel de plataforma): `?organization=` es opcional en el
 * backend — sin él, la cola es la de plataforma (moderador/superadmin/
 * `support`, este último solo lectura desde la página que lo consume).
 * `orgId` pasa a ser opcional aquí; los llamadores existentes (panel de
 * entidad) siguen pasándolo siempre, así que su comportamiento no
 * cambia.
 *
 * **Fix de carry-over (tarea W6, hallazgo real vía e2e contra el
 * backend real):** `ReportViewSet.queue` (`safety/viewsets.py`) responde
 * `Response(ReportSerializer(reportes, many=True).data)` — un **array
 * plano**, nunca paginado (`docs/SEGURIDAD_Y_MODERACION.md` §4: «200
 * lista»). El hook (y los dos componentes que lo consumían,
 * `ReportesQueue.tsx`/`ReportesQueuePlataforma.tsx`) asumían
 * `{count, next, previous, results}` y pintaban botones «Anterior»/
 * «Siguiente» que nunca podían funcionar (el backend no pagina esta
 * acción, `?page=` no tiene ningún efecto) — `e2e/plataforma.spec.ts`
 * hizo saltar `TypeError: Cannot read properties of undefined (reading
 * 'length')` al leer `reports.data.results` de un array real. Se quita
 * el parámetro `page` (dead code: nunca hizo nada) y el tipo pasa a
 * `ReportRow[]`.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { ReportRow } from "@/lib/api/types";

export type ReportsQueueErrorKind = "sin_acceso" | "desconocido";

export class ReportsQueueError extends Error {
  readonly kind: ReportsQueueErrorKind;

  constructor(kind: ReportsQueueErrorKind, message: string) {
    super(message);
    this.name = "ReportsQueueError";
    this.kind = kind;
  }
}

export type ReportStatusFilter = "pending" | "in_review" | "resolved";

export interface ReportsQueueFilters {
  /**
   * `"all"` = los tres estados. Sin `status` el backend devuelve solo lo
   * que sigue en curso (pendiente y en revisión) y no admite «todos», así
   * que el hook pide los tres estados y los junta (error 11 del informe:
   * «Todos» no incluía los resueltos).
   */
  status?: ReportStatusFilter | "all";
}

const ALL_STATUSES: ReportStatusFilter[] = ["pending", "in_review", "resolved"];

function buildQuery(orgId: number | string | undefined, status: ReportStatusFilter | undefined): string {
  const params = new URLSearchParams();
  if (orgId !== undefined) params.set("organization", String(orgId));
  if (status) params.set("status", status);
  return params.toString();
}

export function useReportsQueue(
  orgId?: number | string,
  filters: ReportsQueueFilters = {},
): UseQueryResult<ReportRow[], ReportsQueueError> {
  const statusKey = filters.status ?? "";

  return useQuery<ReportRow[], ReportsQueueError>({
    queryKey: ["panel-reports-queue", orgId ?? "plataforma", statusKey],
    queryFn: async () => {
      try {
        const fetchStatus = (status: ReportStatusFilter | undefined) =>
          apiFetch<ReportRow[]>(`${SAFETY.REPORTS_QUEUE()}?${buildQuery(orgId, status)}`);
        if (filters.status !== "all") return await fetchStatus(filters.status);
        const groups = await Promise.all(ALL_STATUSES.map(fetchStatus));
        return groups.flat().sort((a, b) => b.created_at.localeCompare(a.created_at));
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new ReportsQueueError("sin_acceso", "No tienes acceso a la cola de reportes.");
        }
        throw new ReportsQueueError("desconocido", "No se pudo cargar la cola de reportes.");
      }
    },
  });
}
