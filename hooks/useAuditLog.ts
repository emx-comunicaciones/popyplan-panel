"use client";

/**
 * `GET /api/safety/audit/?actor=&action=&target_type=&target_id=&since=&until=`
 * (superadmin, paginado). **Pendiente de backend** al escribir esta tarea
 * (W5 del panel): la ruta y `AuditLogViewSet` existen ya en el repo del
 * backend, pero no están commiteadas todavía (tarea P6, en curso en
 * paralelo) ni documentadas en `docs/PANEL.md` — la forma que consume
 * este hook viene de leer directamente
 * `safety/serializers.py::AuditLogSerializer` en el repo backend (no
 * solo el contrato escrito): `{id, actor: {id, public_name}, action,
 * target_type, target_id, metadata, ip?, created_at}`, con `ip` solo
 * para `superadmin`. Ver el informe de esta tarea.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { PaginatedAuditLogList } from "@/lib/api/types";

export type AuditLogErrorKind = "sin_acceso" | "desconocido";

export class AuditLogError extends Error {
  readonly kind: AuditLogErrorKind;

  constructor(kind: AuditLogErrorKind, message: string) {
    super(message);
    this.name = "AuditLogError";
    this.kind = kind;
  }
}

export interface AuditLogFilters {
  actor?: number | string;
  action?: string;
  target_type?: string;
  target_id?: string;
  since?: string;
  until?: string;
  page?: number;
}

function buildQuery(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  if (filters.actor !== undefined) params.set("actor", String(filters.actor));
  if (filters.action) params.set("action", filters.action);
  if (filters.target_type) params.set("target_type", filters.target_type);
  if (filters.target_id) params.set("target_id", filters.target_id);
  if (filters.since) params.set("since", filters.since);
  if (filters.until) params.set("until", filters.until);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

export function useAuditLog(
  filters: AuditLogFilters = {},
): UseQueryResult<PaginatedAuditLogList, AuditLogError> {
  const query = buildQuery(filters);

  return useQuery<PaginatedAuditLogList, AuditLogError>({
    queryKey: ["panel-audit-log", query],
    queryFn: async () => {
      try {
        return await apiFetch<PaginatedAuditLogList>(`${SAFETY.AUDIT()}?${query}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new AuditLogError("sin_acceso", "Solo superadmin ve la auditoría de la plataforma.");
        }
        throw new AuditLogError("desconocido", "No se pudo cargar la auditoría.");
      }
    },
  });
}
