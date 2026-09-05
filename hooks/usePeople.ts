"use client";

/**
 * `GET /api/panel/entidad/{org_id}/people/` (`docs/PANEL.md` §3.2).
 * Paginada de verdad (20 por página) aunque `docs/schema.yaml` la marque
 * como un array plano — ver `lib/api/types.ts::PaginatedPersonRowList`
 * para el porqué. `referente` recibe una lista ya filtrada a sus personas
 * asignadas (o vacía, 200) por el propio backend: este hook no repite
 * ese filtro. `includeInvited` (`?include_invited=true`, tarea W3b,
 * §3b.7) mezcla filas `InvitedPersonRow` al final de la página; el mismo
 * recorte por rol se aplica en el backend, no aquí.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { PANEL } from "@/lib/api/endpoints";
import type { PaginatedPersonRowList } from "@/lib/api/types";
import type { Period } from "@/lib/metrics/period";

export interface PeopleFilters {
  community?: string;
  referent?: number;
  activeSince?: string;
  joinedSince?: string;
  search?: string;
  page?: number;
  /**
   * `?include_invited=true` (`docs/PANEL.md` §3b.7, tarea W3b): añade al
   * final de la página una fila `InvitedPersonRow` por cada invitación
   * `pending` de la entidad (recortada al mismo permiso que el resto del
   * listado). Sin él (u omitido), el listado no cambia.
   */
  includeInvited?: boolean;
}

export type PeopleErrorKind = "periodo_invalido" | "sin_acceso" | "desconocido";

export class PeopleError extends Error {
  readonly kind: PeopleErrorKind;

  constructor(kind: PeopleErrorKind, message: string) {
    super(message);
    this.name = "PeopleError";
    this.kind = kind;
  }
}

function buildQuery(period: Period, filters: PeopleFilters): string {
  const params = new URLSearchParams({ since: period.since, until: period.until });
  if (filters.community) params.set("community", filters.community);
  if (filters.referent !== undefined) params.set("referent", String(filters.referent));
  if (filters.activeSince) params.set("active_since", filters.activeSince);
  if (filters.joinedSince) params.set("joined_since", filters.joinedSince);
  if (filters.search) params.set("search", filters.search);
  if (filters.includeInvited) params.set("include_invited", "true");
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

function toPeopleError(error: unknown): PeopleError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return new PeopleError("periodo_invalido", "Los filtros elegidos no son válidos.");
    }
    if (error.status === 403) {
      return new PeopleError("sin_acceso", "No tienes acceso al listado de personas.");
    }
  }
  return new PeopleError("desconocido", "No se pudo cargar el listado de personas.");
}

export function usePeople(
  orgId: number | string,
  period: Period,
  filters: PeopleFilters = {},
): UseQueryResult<PaginatedPersonRowList, PeopleError> {
  const query = buildQuery(period, filters);

  return useQuery<PaginatedPersonRowList, PeopleError>({
    queryKey: ["panel-people", orgId, query],
    queryFn: async () => {
      try {
        return await apiFetch<PaginatedPersonRowList>(`${PANEL.PEOPLE(orgId)}?${query}`);
      } catch (error) {
        throw toPeopleError(error);
      }
    },
  });
}
