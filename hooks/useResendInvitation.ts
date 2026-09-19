"use client";

/**
 * `POST /api/organizations/{org_id}/invitations/{iid}/resend/`
 * (`docs/PANEL.md` §3b.6, tarea W3b): reenvía el correo con el mismo
 * token/código y actualiza `sent_at`. Solo sobre una invitación
 * `pending` (si no, 400); solo titular/moderador.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { EntityInvitation } from "@/lib/api/types";

export type ResendInvitationErrorKind = "invalido" | "sin_permiso" | "no_encontrada" | "desconocido";

/**
 * `kind` (+ `detail`, el texto verbatim del backend cuando lo hay) es lo
 * que traduce `components/entidad/PersonasTable.tsx` (tarea 3 de i18n,
 * `lib/i18n/errorKindText.ts`) — este hook, plano `.ts`, no puede llamar
 * a `t()`, así que `message` sigue en español tal cual (compatibilidad de
 * los tests que ya lo comprueban).
 */
export class ResendInvitationError extends Error {
  readonly kind: ResendInvitationErrorKind;
  readonly detail?: string;

  constructor(kind: ResendInvitationErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "ResendInvitationError";
    this.kind = kind;
    this.detail = detail;
  }
}

export function useResendInvitation(
  orgId: number | string,
): UseMutationResult<EntityInvitation, ResendInvitationError, number> {
  const queryClient = useQueryClient();

  return useMutation<EntityInvitation, ResendInvitationError, number>({
    mutationFn: async (invitationId) => {
      try {
        return await apiFetch<EntityInvitation>(ORGANIZATIONS.INVITATION_RESEND(orgId, invitationId), {
          method: "POST",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new ResendInvitationError(
            "invalido",
            detail ?? "Esta invitación ya no está pendiente.",
            detail,
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new ResendInvitationError(
            "sin_permiso",
            "Solo titular o moderador pueden reenviar invitaciones.",
          );
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new ResendInvitationError("no_encontrada", "Esta invitación no existe.");
        }
        throw new ResendInvitationError("desconocido", "No se pudo reenviar la invitación.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-people", orgId] });
      queryClient.invalidateQueries({ queryKey: ["panel-invitations", orgId] });
    },
  });
}
