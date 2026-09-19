"use client";

/**
 * Descarga de informes (`docs/preguntas-diseno.md` §6: rutas de
 * respaldo mientras `docs/PANEL.md` no tenga su §2 «Exportación»).
 * `GET /api/panel/{entidad,paraguas,plataforma}/*\/export/
 * ?format=csv|pdf&since&until&group_by` devuelve el fichero
 * (`Content-Disposition: attachment`), nunca JSON: no se puede reusar
 * `lib/api/client.ts::apiFetch` (que siempre intenta `JSON.parse` del
 * cuerpo), así que la petición va por `fetchWithAuth` (misma auth, pero
 * devuelve el `Response` sin parsear). `fetchWithAuth` además espera la
 * restauración de arranque de sesión si el token en memoria aún está
 * vacío y, ante un 401, refresca la sesión y reintenta una vez — un
 * access caducado con la cookie de refresh viva ya no se percibe como
 * «No se pudo generar el informe.». La descarga se dispara con un
 * `<a download>` temporal (`lib/download/triggerDownload.ts`, compartido
 * con `hooks/useProgramReport.ts`) y el nombre del fichero sale de
 * `Content-Disposition` (`lib/download/filenameFrom.ts`).
 *
 * Mapeo de errores (`ApiError` de `fetchWithAuth` → `ExportError`):
 * 503 (WeasyPrint no disponible) → `ExportError('pdf_unavailable')`;
 * 403 (sin `exportar_informes`) → `ExportError('forbidden')`;
 * 409 (solo el ámbito `territorio`, spec §3.1: administración sin
 * territorio declarado) → `ExportError('sin_territorio')`;
 * 401 (el refresco también falló: sesión caducada de verdad, avisada
 * por el `SessionExpiredHandler` global) → `ExportError('sesion_caducada')`;
 * cualquier otro estado → `ExportError('desconocido')`.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, fetchWithAuth } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { EXPORT } from "@/lib/api/endpoints";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/auth/sessionEvents";
import { filenameFromContentDisposition } from "@/lib/download/filenameFrom";
import { triggerDownload } from "@/lib/download/triggerDownload";
import type { Period } from "@/lib/metrics/period";

import type { MetricsGroupBy, MetricsScope } from "./useMetrics";

export type ExportFormat = "csv" | "pdf";

export type ExportErrorKind =
  | "pdf_unavailable"
  | "forbidden"
  | "sin_territorio"
  | "sesion_caducada"
  | "desconocido";

export class ExportError extends Error {
  readonly kind: ExportErrorKind;

  constructor(kind: ExportErrorKind, message: string) {
    super(message);
    this.name = "ExportError";
    this.kind = kind;
  }
}

export interface ExportParams {
  scope: MetricsScope;
  orgId?: number | string;
  period: Period;
  format: ExportFormat;
  groupBy?: MetricsGroupBy;
}

function endpointFor(scope: MetricsScope, orgId?: number | string): string {
  switch (scope) {
    case "entidad":
      if (orgId === undefined) {
        throw new Error("useExport: falta orgId para el ámbito 'entidad'");
      }
      return EXPORT.ENTIDAD(orgId);
    case "paraguas":
      if (orgId === undefined) {
        throw new Error("useExport: falta orgId para el ámbito 'paraguas'");
      }
      return EXPORT.PARAGUAS(orgId);
    case "plataforma":
      return EXPORT.PLATAFORMA();
    case "territorio":
      if (orgId === undefined) {
        throw new Error("useExport: falta orgId para el ámbito 'territorio'");
      }
      return EXPORT.TERRITORIO(orgId);
  }
}

function buildQuery(params: ExportParams): string {
  const query = new URLSearchParams({
    format: params.format,
    since: params.period.since,
    until: params.period.until,
  });
  if (params.groupBy) query.set("group_by", params.groupBy);
  return query.toString();
}

function toExportError(error: unknown): ExportError {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return new ExportError(
        "pdf_unavailable",
        detailOf(error) ?? "El informe en PDF no está disponible ahora mismo.",
      );
    }
    if (error.status === 403) {
      return new ExportError("forbidden", "No tienes permiso para exportar informes.");
    }
    if (error.status === 409) {
      return new ExportError(
        "sin_territorio",
        detailOf(error) ?? "Esta administración no tiene territorio declarado.",
      );
    }
    if (error.status === 401) {
      return new ExportError("sesion_caducada", error.message || SESSION_EXPIRED_MESSAGE);
    }
    return new ExportError("desconocido", "No se pudo generar el informe.");
  }
  throw error;
}

export async function downloadExport(params: ExportParams): Promise<void> {
  const path = endpointFor(params.scope, params.orgId);
  const query = buildQuery(params);

  let response: Response;
  try {
    response = await fetchWithAuth(`${path}?${query}`);
  } catch (error) {
    throw toExportError(error);
  }

  const blob = await response.blob();
  const filename = filenameFromContentDisposition(
    response.headers.get("Content-Disposition"),
    `informe.${params.format}`,
  );
  triggerDownload(blob, filename);
}

export function useExport(): UseMutationResult<void, ExportError, ExportParams> {
  return useMutation<void, ExportError, ExportParams>({
    mutationFn: downloadExport,
  });
}
