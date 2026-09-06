"use client";

/**
 * `GET /api/panel/entidad/{org_id}/programs/{program_id}/report/
 * ?format=csv|pdf` (`docs/PANEL.md` §12.4): informe final del programa
 * (métricas mensuales de todo su periodo + cabecera con nombre,
 * financiador y presupuesto), `exportar_informes`. Mismo patrón que
 * `hooks/useExport.ts` (el fichero no es JSON, así que no se puede
 * reusar `apiFetch`: fetch a mano con el token en memoria, descarga con
 * un `<a download>` temporal) pero sin `since`/`until`/`group_by` — el
 * periodo lo decide el propio programa en el backend, la ruta solo
 * acepta `format`.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { PROGRAMS } from "@/lib/api/endpoints";
import { getAccessToken } from "@/lib/auth/tokenStore";

export type ProgramReportFormat = "csv" | "pdf";

export type ProgramReportErrorKind = "pdf_unavailable" | "forbidden" | "desconocido";

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

const DEFAULT_API_URL = "http://localhost:8001";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

async function parseErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { detail?: string };
    return typeof body.detail === "string" ? body.detail : undefined;
  } catch {
    return undefined;
  }
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
  const token = getAccessToken();

  const response = await fetch(`${apiUrl()}${path}?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    if (response.status === 503) {
      const detail = await parseErrorDetail(response);
      throw new ProgramReportError(
        "pdf_unavailable",
        detail ?? "El informe en PDF no está disponible ahora mismo.",
      );
    }
    if (response.status === 403) {
      throw new ProgramReportError("forbidden", "No tienes permiso para exportar informes.");
    }
    throw new ProgramReportError("desconocido", "No se pudo generar el informe.");
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
