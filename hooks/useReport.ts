"use client";

/**
 * `GET /api/safety/reports/{id}/` (`docs/SEGURIDAD_Y_MODERACION.md` §4):
 * detalle de un reporte, con `target`. Moderación de la entidad (si es
 * suyo y no escalado) o de plataforma; `support` solo lectura, y un
 * `target` de tipo `message` no lleva `content` para `support` — esta
 * página nunca la ve `support` (panel de entidad, no de plataforma), así
 * que no hace falta distinguirlo aquí.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { ReportDetail } from "@/lib/api/types";

export type ReportErrorKind = "sin_acceso" | "no_encontrado" | "desconocido";

export class ReportError extends Error {
  readonly kind: ReportErrorKind;

  constructor(kind: ReportErrorKind, message: string) {
    super(message);
    this.name = "ReportError";
    this.kind = kind;
  }
}

export function useReport(reportId: string): UseQueryResult<ReportDetail, ReportError> {
  return useQuery<ReportDetail, ReportError>({
    queryKey: ["panel-report", reportId],
    queryFn: async () => {
      try {
        return await apiFetch<ReportDetail>(SAFETY.REPORT_DETAIL(reportId));
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new ReportError("sin_acceso", "No tienes acceso a este reporte.");
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new ReportError("no_encontrado", "Este reporte no existe.");
        }
        throw new ReportError("desconocido", "No se pudo cargar el reporte.");
      }
    },
    enabled: Boolean(reportId),
  });
}
