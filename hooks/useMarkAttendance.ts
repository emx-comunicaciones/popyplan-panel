"use client";

/**
 * `POST /api/events/{id}/attendance/ {user_id, attended}` — pasar
 * asistencia manual (`events/viewsets.py::EventViewSet.attendance`,
 * `events/services.py::mark_attendance` con `allow_before_start=False`:
 * exige que la actividad ya haya empezado, a diferencia del check-in por
 * QR). Respuesta real `{user_id, status}` — nunca `EventDetail`, pese a
 * lo que dice `docs/schema.yaml` (ver `lib/api/types.ts::AttendanceMarkResponse`).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { EVENTS } from "@/lib/api/endpoints";
import type { AttendanceMarkResponse } from "@/lib/api/types";

export type MarkAttendanceErrorKind = "invalido" | "no_inscrita" | "sin_permiso" | "desconocido";

export class MarkAttendanceError extends Error {
  readonly kind: MarkAttendanceErrorKind;

  constructor(kind: MarkAttendanceErrorKind, message: string) {
    super(message);
    this.name = "MarkAttendanceError";
    this.kind = kind;
  }
}

function toMarkAttendanceError(error: unknown): MarkAttendanceError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return new MarkAttendanceError(
        "invalido",
        detailOf(error) ?? "No se pudo marcar la asistencia.",
      );
    }
    if (error.status === 403) {
      return new MarkAttendanceError("sin_permiso", "No organizas esta actividad.");
    }
    if (error.status === 404) {
      return new MarkAttendanceError(
        "no_inscrita",
        detailOf(error) ?? "Esa persona no está apuntada.",
      );
    }
  }
  return new MarkAttendanceError("desconocido", "No se pudo marcar la asistencia.");
}

export interface MarkAttendanceInput {
  userId: number;
  attended: boolean;
}

export function useMarkAttendance(
  eventId: string,
): UseMutationResult<AttendanceMarkResponse, MarkAttendanceError, MarkAttendanceInput> {
  const queryClient = useQueryClient();

  return useMutation<AttendanceMarkResponse, MarkAttendanceError, MarkAttendanceInput>({
    mutationFn: async ({ userId, attended }) => {
      try {
        return await apiFetch<AttendanceMarkResponse>(EVENTS.ATTENDANCE(eventId), {
          method: "POST",
          body: { user_id: userId, attended },
        });
      } catch (error) {
        throw toMarkAttendanceError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] });
    },
  });
}
