"use client";

/**
 * `GET /api/admin/dashboard-stats/` (`pop/dashboard_api.py::DashboardStatsView`,
 * `IsAdminUser`): agregados generales para el Inicio de plataforma
 * (usuarios activos, actividades programadas, reportes/ayuda
 * pendientes). Solo `is_staff` — hoy solo `superadmin` lo tiene
 * (`docs/SEGURIDAD_Y_MODERACION.md` §1) — así que un 403 no es un error
 * de página: se traduce a `data: null` y el Inicio oculta esas tarjetas
 * en vez de romper (mismo criterio que los contadores de guardia del
 * Inicio de entidad, W3).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { DASHBOARD } from "@/lib/api/endpoints";
import type { DashboardStats } from "@/lib/api/types";

export class DashboardStatsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardStatsError";
  }
}

export function useDashboardStats(): UseQueryResult<DashboardStats | null, DashboardStatsError> {
  return useQuery<DashboardStats | null, DashboardStatsError>({
    queryKey: ["panel-dashboard-stats"],
    queryFn: async () => {
      try {
        return await apiFetch<DashboardStats>(DASHBOARD.STATS());
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          return null;
        }
        throw new DashboardStatsError("No se pudieron cargar las estadísticas generales.");
      }
    },
  });
}
