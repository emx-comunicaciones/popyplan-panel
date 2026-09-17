"use client";

/**
 * Acciones de moderación sobre un reporte (`docs/SEGURIDAD_Y_MODERACION.md`
 * §4): asignarme (`assign`, sin cuerpo — el backend asigna al usuario que
 * llama), resolver (`resolve {resolution, note?}`) y escalar (`escalate
 * {note?}`). Las tres invalidan el detalle y la cola tras tener éxito.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { SAFETY } from "@/lib/api/endpoints";
import type { ReportDetail, ReportResolution } from "@/lib/api/types";

export type ReportActionErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class ReportActionError extends Error {
  readonly kind: ReportActionErrorKind;

  constructor(kind: ReportActionErrorKind, message: string) {
    super(message);
    this.name = "ReportActionError";
    this.kind = kind;
  }
}

function toReportActionError(error: unknown, fallback: string): ReportActionError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return new ReportActionError("invalido", detailOf(error) ?? fallback);
    }
    if (error.status === 403) {
      return new ReportActionError("sin_permiso", "No tienes permiso para actuar sobre este reporte.");
    }
  }
  return new ReportActionError("desconocido", fallback);
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, reportId: string): void {
  queryClient.invalidateQueries({ queryKey: ["panel-report", reportId] });
  queryClient.invalidateQueries({ queryKey: ["panel-reports-queue"] });
}

export function useAssignReport(): UseMutationResult<ReportDetail, ReportActionError, string> {
  const queryClient = useQueryClient();

  return useMutation<ReportDetail, ReportActionError, string>({
    mutationFn: async (reportId) => {
      try {
        return await apiFetch<ReportDetail>(SAFETY.REPORT_ASSIGN(reportId), { method: "POST" });
      } catch (error) {
        throw toReportActionError(error, "No se pudo asignar el reporte.");
      }
    },
    onSuccess: (_data, reportId) => invalidate(queryClient, reportId),
  });
}

export interface ResolveReportInput {
  reportId: string;
  resolution: ReportResolution;
  note?: string;
}

export function useResolveReport(): UseMutationResult<
  ReportDetail,
  ReportActionError,
  ResolveReportInput
> {
  const queryClient = useQueryClient();

  return useMutation<ReportDetail, ReportActionError, ResolveReportInput>({
    mutationFn: async ({ reportId, resolution, note }) => {
      try {
        return await apiFetch<ReportDetail>(SAFETY.REPORT_RESOLVE(reportId), {
          method: "POST",
          body: { resolution, ...(note ? { note } : {}) },
        });
      } catch (error) {
        throw toReportActionError(error, "No se pudo resolver el reporte.");
      }
    },
    onSuccess: (_data, variables) => invalidate(queryClient, variables.reportId),
  });
}

export interface EscalateReportInput {
  reportId: string;
  note?: string;
}

export function useEscalateReport(): UseMutationResult<
  ReportDetail,
  ReportActionError,
  EscalateReportInput
> {
  const queryClient = useQueryClient();

  return useMutation<ReportDetail, ReportActionError, EscalateReportInput>({
    mutationFn: async ({ reportId, note }) => {
      try {
        return await apiFetch<ReportDetail>(SAFETY.REPORT_ESCALATE(reportId), {
          method: "POST",
          body: note ? { note } : {},
        });
      } catch (error) {
        throw toReportActionError(error, "No se pudo escalar el reporte.");
      }
    },
    onSuccess: (_data, variables) => invalidate(queryClient, variables.reportId),
  });
}
