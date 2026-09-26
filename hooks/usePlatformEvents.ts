"use client";

/**
 * Actividades vistas por la plataforma (admin de plataforma, bloque 3,
 * 2026-09-26). **No hay un listado global** en el backend
 * (`events/viewsets.py::EventViewSet`):
 * - `GET /api/events/agenda/?from=&to=&page=` (`PLATFORM_EVENTS.AGENDA`)
 *   solo da actividades `scheduled` desde `from`, con audiencia `anyone`
 *   u `organization` de entidades de las que la cuenta sea miembro — sin
 *   atajo para staff;
 * - `GET /api/events/?community=<uuid>&page=` (`EVENTS.LIST`) da todas las
 *   de esa comunidad, pasadas y canceladas incluidas (`is_staff` pasa
 *   `community.can_manage`).
 * Las dos paginan de 20 en 20 (`?page_size=` no hace nada).
 *
 * Cancelar (`POST /api/events/{id}/cancel/`, `EVENTS.CANCEL`) lo concede
 * `Event.is_organizer` a `is_staff` aunque no organice la actividad. El
 * backend no impide cancelar dos veces ni una actividad ya celebrada, no
 * lo audita y avisa a las personas inscritas y en espera.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { COMMUNITIES, EVENTS, PLATFORM_EVENTS } from "@/lib/api/endpoints";
import type { EventDetail, Paginated, PlatformEventRow } from "@/lib/api/types";

export type PlatformEventsErrorKind = "invalido" | "sin_acceso" | "no_encontrado" | "desconocido";

export class PlatformEventsError extends Error {
  readonly kind: PlatformEventsErrorKind;
  readonly detail?: string;

  constructor(kind: PlatformEventsErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "PlatformEventsError";
    this.kind = kind;
    this.detail = detail;
  }
}

export const PLATFORM_EVENTS_KEY = "panel-platform-events";

export type PlatformEventsSource =
  | { kind: "agenda"; from?: string; to?: string }
  | { kind: "community"; communityId: string };

export function usePlatformEvents(
  source: PlatformEventsSource,
  page: number,
): UseQueryResult<Paginated<PlatformEventRow>, PlatformEventsError> {
  const params = new URLSearchParams({ page: String(page) });
  let base: string;
  if (source.kind === "agenda") {
    base = PLATFORM_EVENTS.AGENDA();
    if (source.from) params.set("from", source.from);
    if (source.to) params.set("to", source.to);
  } else {
    base = EVENTS.LIST();
    params.set("community", source.communityId);
  }
  const url = `${base}?${params.toString()}`;

  return useQuery<Paginated<PlatformEventRow>, PlatformEventsError>({
    queryKey: [PLATFORM_EVENTS_KEY, url],
    queryFn: async () => {
      try {
        return await apiFetch<Paginated<PlatformEventRow>>(url);
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new PlatformEventsError("invalido", detail ?? "Revisa los filtros.", detail);
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new PlatformEventsError("sin_acceso", "No tienes acceso a estas actividades.");
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new PlatformEventsError("no_encontrado", "Esa página o esa comunidad ya no existe.");
        }
        throw new PlatformEventsError("desconocido", "No se pudieron cargar las actividades.");
      }
    },
  });
}

/**
 * Buscador de comunidades para elegir la del modo «Por comunidad»:
 * `GET /api/communities/?search=` (`COMMUNITIES.LIST`, que a `is_staff`
 * le da todas, privadas y de entidad incluidas). Solo la primera página
 * (20): es un buscador, no un listado. Con menos de dos caracteres no
 * pide nada.
 */
export function useCommunitySearch(search: string): UseQueryResult<CommunitySearchRow[], PlatformEventsError> {
  const trimmed = search.trim();
  return useQuery<CommunitySearchRow[], PlatformEventsError>({
    queryKey: ["panel-platform-community-search", trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      try {
        const data = await apiFetch<Paginated<CommunitySearchRow>>(
          `${COMMUNITIES.LIST()}?search=${encodeURIComponent(trimmed)}`,
        );
        return data.results;
      } catch {
        throw new PlatformEventsError("desconocido", "No se pudieron buscar comunidades.");
      }
    },
  });
}

export interface CommunitySearchRow {
  id: string;
  name: string;
}

export function useCancelPlatformEvent(): UseMutationResult<EventDetail, PlatformEventsError, string> {
  const queryClient = useQueryClient();
  return useMutation<EventDetail, PlatformEventsError, string>({
    mutationFn: async (eventId) => {
      try {
        return await apiFetch<EventDetail>(EVENTS.CANCEL(eventId), { method: "POST" });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new PlatformEventsError("sin_acceso", "No puedes cancelar esta actividad.", detailOf(error));
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new PlatformEventsError("no_encontrado", "Esta actividad ya no existe.");
        }
        throw new PlatformEventsError("desconocido", "No se pudo cancelar la actividad.");
      }
    },
    onSuccess: (_data, eventId) => {
      void queryClient.invalidateQueries({ queryKey: [PLATFORM_EVENTS_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["panel-event", eventId] });
    },
  });
}
