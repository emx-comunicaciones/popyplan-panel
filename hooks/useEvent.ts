"use client";

/**
 * `GET /api/events/{id}/` (`events/viewsets.py::EventViewSet.retrieve`,
 * de lectura abierta a cualquier autenticado que la vea en su
 * `eventos_visibles_para`): usado solo por `ActividadForm.tsx` para
 * traer los campos que `EntityEventRow` (el listado de
 * `hooks/useEntityEvents.ts`) no lleva —`description`, `ends_at`,
 * `latitude`/`longitude`, `place`— antes de abrir el formulario de
 * edición. Quien monta el diálogo ya vio la actividad en la tabla, así
 * que un 403/404 aquí es un caso raro (el rol cambió entre el render y
 * el clic) y no necesita más detalle que «sin acceso».
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { EVENTS } from "@/lib/api/endpoints";
import type { EventDetail } from "@/lib/api/types";

export type EventErrorKind = "sin_acceso" | "desconocido";

export class EventError extends Error {
  readonly kind: EventErrorKind;

  constructor(kind: EventErrorKind, message: string) {
    super(message);
    this.name = "EventError";
    this.kind = kind;
  }
}

function toEventError(error: unknown): EventError {
  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return new EventError("sin_acceso", "No tienes acceso a esta actividad.");
  }
  return new EventError("desconocido", "No se pudo cargar la actividad.");
}

export function useEvent(eventId: string, enabled = true): UseQueryResult<EventDetail, EventError> {
  return useQuery<EventDetail, EventError>({
    queryKey: ["panel-event", eventId],
    enabled: enabled && eventId.length > 0,
    queryFn: async () => {
      try {
        return await apiFetch<EventDetail>(EVENTS.DETAIL(eventId));
      } catch (error) {
        throw toEventError(error);
      }
    },
  });
}
