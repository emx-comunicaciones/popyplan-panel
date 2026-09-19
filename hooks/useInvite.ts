"use client";

/**
 * `POST /api/organizations/{org_id}/invitations/ {email, display_name?,
 * phone?, community?, referent_user?}` (`docs/PANEL.md` §3b.2, tarea
 * W3b): invitación manual, una persona. Solo titular/moderador (`equipo`
 * o `moderar`). Si el correo ya es miembro activo de una comunidad de la
 * entidad, el backend responde **409** («Alta de una entidad ya miembro
 * activo», §3b.1) — se traduce al mensaje exacto que pide el brief.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { EntityInvitation } from "@/lib/api/types";

export type InviteErrorKind = "invalido" | "sin_permiso" | "ya_es_miembro" | "desconocido";

/**
 * `kind` (+ `detail`, el texto verbatim del backend cuando lo hay) es lo
 * que traduce `components/people/AddPersonDialog.tsx` (tarea 3 de i18n,
 * `lib/i18n/errorKindText.ts`) — este hook, plano `.ts`, no puede llamar
 * a `t()`, así que `message` sigue en español tal cual (compatibilidad de
 * los tests que ya lo comprueban).
 */
export class InviteError extends Error {
  readonly kind: InviteErrorKind;
  readonly detail?: string;

  constructor(kind: InviteErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "InviteError";
    this.kind = kind;
    this.detail = detail;
  }
}

export interface InviteInput {
  email: string;
  displayName?: string;
  phone?: string;
  community?: string | null;
  referentUser?: number | null;
}

export function useInvite(
  orgId: number | string,
): UseMutationResult<EntityInvitation, InviteError, InviteInput> {
  const queryClient = useQueryClient();

  return useMutation<EntityInvitation, InviteError, InviteInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<EntityInvitation>(ORGANIZATIONS.INVITATIONS(orgId), {
          method: "POST",
          body: {
            email: input.email,
            display_name: input.displayName ?? "",
            phone: input.phone ?? "",
            community: input.community ?? null,
            referent_user: input.referentUser ?? null,
          },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new InviteError("invalido", detail ?? "Revisa los datos: alguno no es válido.", detail);
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new InviteError("sin_permiso", "Solo titular o moderador pueden invitar personas.");
        }
        if (error instanceof ApiError && error.status === 409) {
          throw new InviteError("ya_es_miembro", "Esta persona ya es miembro de la entidad.");
        }
        throw new InviteError("desconocido", "No se pudo enviar la invitación.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-people", orgId] });
      queryClient.invalidateQueries({ queryKey: ["panel-invitations", orgId] });
    },
  });
}
