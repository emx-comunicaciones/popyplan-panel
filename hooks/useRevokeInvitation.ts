"use client";

/**
 * `DELETE /api/organizations/{org_id}/invitations/{iid}/`
 * (`docs/PANEL.md` §3b.6, tarea W3b): revoca una invitación `pending` y
 * borra sus datos personales (`email`/`display_name`/`phone_hash`). Solo
 * sobre una invitación `pending` (si no, 400); solo titular/moderador.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";

export type RevokeInvitationErrorKind = "invalido" | "sin_permiso" | "no_encontrada" | "desconocido";

/**
 * `kind` (+ `detail`, el texto verbatim del backend cuando lo hay) es lo
 * que traduce `components/entidad/PersonasTable.tsx` (tarea 3 de i18n,
 * `lib/i18n/errorKindText.ts`) — este hook, plano `.ts`, no puede llamar
 * a `t()`, así que `message` sigue en español tal cual (compatibilidad de
 * los tests que ya lo comprueban).
 */
export class RevokeInvitationError extends Error {
  readonly kind: RevokeInvitationErrorKind;
  readonly detail?: string;

  constructor(kind: RevokeInvitationErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "RevokeInvitationError";
    this.kind = kind;
    this.detail = detail;
  }
}

export function useRevokeInvitation(
  orgId: number | string,
): UseMutationResult<void, RevokeInvitationError, number> {
  const queryClient = useQueryClient();

  return useMutation<void, RevokeInvitationError, number>({
    mutationFn: async (invitationId) => {
      try {
        await apiFetch<void>(ORGANIZATIONS.INVITATION(orgId, invitationId), { method: "DELETE" });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new RevokeInvitationError(
            "invalido",
            detail ?? "Esta invitación ya no está pendiente.",
            detail,
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new RevokeInvitationError(
            "sin_permiso",
            "Solo titular o moderador pueden revocar invitaciones.",
          );
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new RevokeInvitationError("no_encontrada", "Esta invitación no existe.");
        }
        throw new RevokeInvitationError("desconocido", "No se pudo revocar la invitación.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-people", orgId] });
      queryClient.invalidateQueries({ queryKey: ["panel-invitations", orgId] });
    },
  });
}
