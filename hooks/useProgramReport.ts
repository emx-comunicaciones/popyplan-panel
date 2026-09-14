"use client";

/**
 * `GET /api/panel/entidad/{org_id}/programs/{program_id}/report/
 * ?format=csv|pdf` (`docs/PANEL.md` §12.4): informe final del programa
 * (métricas mensuales de todo su periodo + cabecera con nombre,
 * financiador y presupuesto), `exportar_informes`. Mismo patrón que
 * `hooks/useExport.ts` (el fichero no es JSON, así que no se puede
 * reusar `apiFetch`: la petición va por `fetchWithAuth`, que devuelve el
 * `Response` sin parsear y además espera la restauración de arranque y
 * refresca ante un 401) pero sin `since`/`until`/`group_by` — el
 * periodo lo decide el propio programa en el backend, la ruta solo
 * acepta `format`. El 401 con refresco fallido llega como
 * `ProgramReportError('sesion_caducada')`, el resto del mapeo es igual
 * que en `useExport.ts`.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, fetchWithAuth } from "@/lib/api/client";
import { PROGRAMS } from "@/lib/api/endpoints";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/auth/sessionEvents";

export type ProgramReportFormat = "csv" | "pdf";

export type ProgramReportErrorKind =
  | "pdf_unavailable"
  | "forbidden"
  | "sesion_caducada"
  | "desconocido";

export class ProgramReportError extends Error {
  readonly kind: ProgramReportErrorKind;

  constructor(kind: ProgramReportErrorKind, message: string) {
    super(message);
    this.name = "ProgramReportError";
    this.kind = kind;
  }
}

export interface ProgramReportParams {
  orgId: number | string;
  programId: number | string;
  format: ProgramReportFormat;
}

function detailOf(error: ApiError): string | undefined {
  const body = error.body as { detail?: unknown } | null;
  return typeof body?.detail === "string" ? body.detail : undefined;
}

function toProgramReportError(error: unknown): ProgramReportError {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return new ProgramReportError(
        "pdf_unavailable",
        detailOf(error) ?? "El informe en PDF no está disponible ahora mismo.",
      );
    }
    if (error.status === 403) {
      return new ProgramReportError("forbidden", "No tienes permiso para exportar informes.");
    }
    if (error.status === 401) {
      return new ProgramReportError("sesion_caducada", error.message || SESSION_EXPIRED_MESSAGE);
    }
    return new ProgramReportError("desconocido", "No se pudo generar el informe.");
  }
  throw error;
}

function filenameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="?([^";]+)"?/.exec(header);
  return match ? match[1] : fallback;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadProgramReport(params: ProgramReportParams): Promise<void> {
  const path = PROGRAMS.REPORT(params.orgId, params.programId);
  const query = new URLSearchParams({ format: params.format }).toString();

  let response: Response;
  try {
    response = await fetchWithAuth(`${path}?${query}`);
  } catch (error) {
    throw toProgramReportError(error);
  }

  const blob = await response.blob();
  const filename = filenameFrom(
    response.headers.get("Content-Disposition"),
    `informe-programa.${params.format}`,
  );
  triggerDownload(blob, filename);
}

export function useProgramReport(): UseMutationResult<void, ProgramReportError, ProgramReportParams> {
  return useMutation<void, ProgramReportError, ProgramReportParams>({
    mutationFn: downloadProgramReport,
  });
}
