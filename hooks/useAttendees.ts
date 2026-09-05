"use client";

/**
 * `GET /api/events/{id}/attendees/` — lista nominal, solo quien organiza
 * (`events/viewsets.py::EventViewSet.attendees`). Array plano de
 * `Attendee`, pese a que `docs/schema.yaml` la marca (mal) como
 * `PaginatedAttendeeList` — ver `lib/api/types.ts::Attendee` para el
 * porqué. Invariante 5 ya aplicada por el backend: quien está bloqueado
 * con el organizador no aparece.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { EVENTS } from "@/lib/api/endpoints";
import type { Attendee } from "@/lib/api/types";

export type AttendeesErrorKind = "sin_permiso" | "desconocido";

export class AttendeesError extends Error {
  readonly kind: AttendeesErrorKind;

  constructor(kind: AttendeesErrorKind, message: string) {
    super(message);
    this.name = "AttendeesError";
    this.kind = kind;
  }
}

function toAttendeesError(error: unknown): AttendeesError {
  if (error instanceof ApiError && error.status === 403) {
    return new AttendeesError("sin_permiso", "No organizas esta actividad.");
  }
  return new AttendeesError("desconocido", "No se pudo cargar la lista de asistentes.");
}

export function useAttendees(eventId: string): UseQueryResult<Attendee[], AttendeesError> {
  return useQuery<Attendee[], AttendeesError>({
    queryKey: ["event-attendees", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      try {
        return await apiFetch<Attendee[]>(EVENTS.ATTENDEES(eventId));
      } catch (error) {
        throw toAttendeesError(error);
      }
    },
  });
}
