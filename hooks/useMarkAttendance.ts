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

/**
 * `kind` (+ `detail`, el texto verbatim del backend cuando lo hay) es lo
 * que traduce `components/entidad/AttendanceView.tsx` (tarea 3 de i18n,
 * `lib/i18n/errorKindText.ts`) — este hook, plano `.ts`, no puede llamar
 * a `t()`, así que `message` sigue en español tal cual (compatibilidad de
 * los tests que ya lo comprueban).
 */
export class MarkAttendanceError extends Error {
  readonly kind: MarkAttendanceErrorKind;
  readonly detail?: string;

  constructor(kind: MarkAttendanceErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "MarkAttendanceError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toMarkAttendanceError(error: unknown): MarkAttendanceError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      const detail = detailOf(error);
      return new MarkAttendanceError("invalido", detail ?? "No se pudo marcar la asistencia.", detail);
    }
    if (error.status === 403) {
      return new MarkAttendanceError("sin_permiso", "No organizas esta actividad.");
    }
    if (error.status === 404) {
      const detail = detailOf(error);
      return new MarkAttendanceError("no_inscrita", detail ?? "Esa persona no está apuntada.", detail);
    }
  }
  return new MarkAttendanceError("desconocido", "No se pudo marcar la asistencia.");
}

export interface MarkAttendanceInput {
  userId: number;
  attended: boolean;
}

/**
 * `orgId` no viaja en la petición: sirve solo para invalidar los listados
 * de la entidad que dependen de la asistencia (actividades y fichas de
 * persona), cuyas claves lo llevan.
 */
export function useMarkAttendance(
  eventId: string,
  orgId: number | string,
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
      // Marcar asistencia cambia el recuento «asistió/no asistió» de la
      // actividad y el historial de la ficha de la persona. Las dos
      // familias llevan periodo/filtros en la clave: prefijo.
      queryClient.invalidateQueries({ queryKey: ["panel-entity-events", orgId] });
      queryClient.invalidateQueries({ queryKey: ["panel-person", orgId] });
    },
  });
}
