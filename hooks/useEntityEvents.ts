"use client";

/**
 * `GET /api/panel/entidad/{org_id}/events/?since&until&status`
 * (`docs/PANEL.md` §3.4). Sin paginar: el backend devuelve directamente
 * un array de filas. `organizer` viaja `null` para quien no tiene
 * `ver_lista_nominal` (invariante «el analista nunca ve nombres»); este
 * hook no lo oculta ni lo rellena, se limita a pasar lo que llega.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { PANEL } from "@/lib/api/endpoints";
import type { EntityEventRow } from "@/lib/api/types";
import type { Period } from "@/lib/metrics/period";

export type EntityEventStatus = "scheduled" | "cancelled" | "completed";

export type EntityEventsErrorKind = "periodo_invalido" | "sin_acceso" | "desconocido";

/**
 * `kind` es lo único que necesita el componente para traducir (tarea 3 de
 * i18n, `CLAUDE.md`): este hook, plano `.ts`, no puede llamar a `t()`, así
 * que sigue construyendo `message` en español tal cual (compatibilidad de
 * los tests que ya lo comprueban) — `components/entidad/{EntityHomeDashboard,
 * ActividadesTable}.tsx` lo ignoran y traducen por `kind`
 * (`lib/i18n/errorKindText.ts`).
 */
export class EntityEventsError extends Error {
  readonly kind: EntityEventsErrorKind;

  constructor(kind: EntityEventsErrorKind, message: string) {
    super(message);
    this.name = "EntityEventsError";
    this.kind = kind;
  }
}

function toEntityEventsError(error: unknown): EntityEventsError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return new EntityEventsError("periodo_invalido", "El periodo o el filtro elegido no es válido.");
    }
    if (error.status === 403) {
      return new EntityEventsError("sin_acceso", "No tienes acceso a las actividades de esta entidad.");
    }
  }
  return new EntityEventsError("desconocido", "No se pudieron cargar las actividades.");
}

export function useEntityEvents(
  orgId: number | string,
  period: Period,
  status?: EntityEventStatus,
): UseQueryResult<EntityEventRow[], EntityEventsError> {
  const params = new URLSearchParams({ since: period.since, until: period.until });
  if (status) params.set("status", status);
  const query = params.toString();

  return useQuery<EntityEventRow[], EntityEventsError>({
    queryKey: ["panel-entity-events", orgId, query],
    queryFn: async () => {
      try {
        return await apiFetch<EntityEventRow[]>(`${PANEL.EVENTS(orgId)}?${query}`);
      } catch (error) {
        throw toEntityEventsError(error);
      }
    },
  });
}
