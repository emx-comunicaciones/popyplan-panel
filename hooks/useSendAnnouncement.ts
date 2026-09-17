"use client";

/**
 * `POST /api/panel/entidad/{org_id}/announcements/ {title, body, audience}`
 * (`docs/PANEL.md` §5): compone y envía una comunicación oficial. Solo
 * titular/moderador (el resto de roles con `ver_panel` recibe 403 con
 * detalle explícito, comprobado a mano en la vista del backend).
 * `audience='families'` responde 400 (`{"detail": "El espacio de
 * familias llega en la siguiente tarea."}`, §5.2: marcador de posición
 * hasta P6); `audience='community:<uuid>'` de una comunidad de otra
 * entidad, o inexistente, también 400.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { PANEL } from "@/lib/api/endpoints";
import type { Announcement, AnnouncementAudienceInput } from "@/lib/api/types";

export type SendAnnouncementErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class SendAnnouncementError extends Error {
  readonly kind: SendAnnouncementErrorKind;

  constructor(kind: SendAnnouncementErrorKind, message: string) {
    super(message);
    this.name = "SendAnnouncementError";
    this.kind = kind;
  }
}

export interface SendAnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudienceInput;
}

export function useSendAnnouncement(
  orgId: number | string,
): UseMutationResult<Announcement, SendAnnouncementError, SendAnnouncementInput> {
  const queryClient = useQueryClient();

  return useMutation<Announcement, SendAnnouncementError, SendAnnouncementInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<Announcement>(PANEL.ANNOUNCEMENTS(orgId), {
          method: "POST",
          body: input,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          throw new SendAnnouncementError(
            "invalido",
            detailOf(error) ?? "Revisa los datos: la audiencia no es válida.",
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new SendAnnouncementError(
            "sin_permiso",
            "Solo titular o moderador pueden enviar comunicaciones.",
          );
        }
        throw new SendAnnouncementError("desconocido", "No se pudo enviar la comunicación.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-announcements", orgId] });
    },
  });
}
