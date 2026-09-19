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
import { detailOf } from "@/lib/api/drfError";
import { PROGRAMS } from "@/lib/api/endpoints";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/auth/sessionEvents";
import { filenameFromContentDisposition } from "@/lib/download/filenameFrom";
import { triggerDownload } from "@/lib/download/triggerDownload";

export type ProgramReportFormat = "csv" | "pdf";

export type ProgramReportErrorKind =
  | "pdf_unavailable"
  | "forbidden"
  | "sesion_caducada"
  | "desconocido";

export class ProgramReportError extends Error {
  readonly kind: ProgramReportErrorKind;
  readonly detail?: string;

  constructor(kind: ProgramReportErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "ProgramReportError";
    this.kind = kind;
    this.detail = detail;
  }
}

export interface ProgramReportParams {
  orgId: number | string;
  programId: number | string;
  format: ProgramReportFormat;
}

function toProgramReportError(error: unknown): ProgramReportError {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      const detail = detailOf(error);
      return new ProgramReportError(
        "pdf_unavailable",
        detail ?? "El informe en PDF no está disponible ahora mismo.",
        detail,
      );
    }
    if (error.status === 403) {
      return new ProgramReportError("forbidden", "No tienes permiso para exportar informes.");
    }
    if (error.status === 401) {
      // El cuerpo de este 401 es siempre `null` (`requestWithAuth`,
      // `lib/api/client.ts`): `detailOf` nunca encuentra nada aquí en la
      // práctica, pero se llama igual por si el contrato cambiara algún
      // día a mandar un cuerpo — mismo criterio que el resto de ramas.
      const detail = detailOf(error);
      return new ProgramReportError("sesion_caducada", error.message || SESSION_EXPIRED_MESSAGE, detail);
    }
    return new ProgramReportError("desconocido", "No se pudo generar el informe.");
  }
  throw error;
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
  const filename = filenameFromContentDisposition(
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
