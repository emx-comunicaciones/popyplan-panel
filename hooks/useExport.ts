"use client";

/**
 * Descarga de informes (`docs/preguntas-diseno.md` §6: rutas de
 * respaldo mientras `docs/PANEL.md` no tenga su §2 «Exportación»).
 * `GET /api/panel/{entidad,paraguas,plataforma}/*\/export/
 * ?format=csv|pdf&since&until&group_by` devuelve el fichero
 * (`Content-Disposition: attachment`), nunca JSON: no se puede reusar
 * `lib/api/client.ts::apiFetch` (que siempre intenta `JSON.parse` del
 * cuerpo). Este hook hace el `fetch` a mano con el access token en
 * memoria (`lib/auth/tokenStore.ts`) y dispara la descarga con un
 * `<a download>` temporal — el sandbox de un artefacto bloquearía esto,
 * pero aquí es una pestaña real del navegador.
 *
 * 503 (WeasyPrint no disponible) → `ExportError('pdf_unavailable')`;
 * 403 (sin `exportar_informes`) → `ExportError('forbidden')`.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { EXPORT } from "@/lib/api/endpoints";
import { getAccessToken } from "@/lib/auth/tokenStore";
import type { Period } from "@/lib/metrics/period";

import type { MetricsGroupBy, MetricsScope } from "./useMetrics";

export type ExportFormat = "csv" | "pdf";

export type ExportErrorKind = "pdf_unavailable" | "forbidden" | "desconocido";

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

const DEFAULT_API_URL = "http://localhost:8001";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
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

export async function downloadExport(params: ExportParams): Promise<void> {
  const path = endpointFor(params.scope, params.orgId);
  const query = buildQuery(params);
  const token = getAccessToken();

  const response = await fetch(`${apiUrl()}${path}?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    if (response.status === 503) {
      const detail = await parseErrorDetail(response);
      throw new ExportError(
        "pdf_unavailable",
        detail ?? "El informe en PDF no está disponible ahora mismo.",
      );
    }
    if (response.status === 403) {
      throw new ExportError("forbidden", "No tienes permiso para exportar informes.");
    }
    throw new ExportError("desconocido", "No se pudo generar el informe.");
  }

  const blob = await response.blob();
  const filename = filenameFrom(
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
