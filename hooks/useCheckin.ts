"use client";

/**
 * `POST /api/events/{id}/checkin/ {token}` (`docs/PANEL.md` §4.3): el
 * responsable pega o escanea el token del QR y da entrada. Idempotente
 * (`already: true` si ya se había dado, sin comprobar ventana); fuera de
 * `starts_at-2h..starts_at+12h` → 409; token de otra actividad o
 * desconocido → 404 (ambos casos colapsan en el mismo mensaje, para no
 * confirmar si el token "existe en otro sitio" — ver §4.3).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { EVENTS } from "@/lib/api/endpoints";
import type { CheckinResponse } from "@/lib/api/types";

export type CheckinErrorKind = "token_desconocido" | "fuera_de_ventana" | "sin_permiso" | "desconocido";

export class CheckinError extends Error {
  readonly kind: CheckinErrorKind;

  constructor(kind: CheckinErrorKind, message: string) {
    super(message);
    this.name = "CheckinError";
    this.kind = kind;
  }
}

function toCheckinError(error: unknown): CheckinError {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return new CheckinError(
        "token_desconocido",
        "Token de check-in desconocido para esta actividad.",
      );
    }
    if (error.status === 409) {
      return new CheckinError(
        "fuera_de_ventana",
        "Fuera de la ventana de check-in de esta actividad.",
      );
    }
    if (error.status === 403) {
      return new CheckinError("sin_permiso", "No organizas esta actividad.");
    }
  }
  return new CheckinError("desconocido", "No se pudo dar el check-in.");
}

/**
 * `orgId` no viaja en la petición: sirve solo para invalidar los listados
 * de la entidad que dependen de la asistencia (actividades y fichas de
 * persona), cuyas claves lo llevan.
 */
export function useCheckin(
  eventId: string,
  orgId: number | string,
): UseMutationResult<CheckinResponse, CheckinError, { token: string }> {
  const queryClient = useQueryClient();

  return useMutation<CheckinResponse, CheckinError, { token: string }>({
    mutationFn: async ({ token }) => {
      try {
        return await apiFetch<CheckinResponse>(EVENTS.CHECKIN(eventId), {
          method: "POST",
          body: { token },
        });
      } catch (error) {
        throw toCheckinError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] });
      // Mismo efecto que marcar asistencia a mano (`useMarkAttendance`):
      // cambia el recuento de la actividad y el historial de la ficha.
      queryClient.invalidateQueries({ queryKey: ["panel-entity-events", orgId] });
      queryClient.invalidateQueries({ queryKey: ["panel-person", orgId] });
    },
  });
}
