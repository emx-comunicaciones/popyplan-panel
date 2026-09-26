"use client";

/**
 * `PATCH /api/organizations/{id}/ {tracking_program_enabled}`
 * (`docs/PANEL.md` §18.2): enciende o apaga el programa de seguimiento de
 * una entidad. **Solo `superadmin`** (403 a cualquier otro); encenderlo
 * exige una asociación u ONG **verificada** (400 en
 * `tracking_program_enabled`, cuyo texto se pinta tal cual). Apagarlo deja
 * las inscripciones en suspenso, sin borrar nada.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { Organization } from "@/lib/api/types";

export type SetTrackingProgramErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class SetTrackingProgramError extends Error {
  readonly kind: SetTrackingProgramErrorKind;
  readonly detail?: string;

  constructor(kind: SetTrackingProgramErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "SetTrackingProgramError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toSetTrackingProgramError(error: unknown): SetTrackingProgramError {
  if (error instanceof ApiError && error.status === 400) {
    const detail = detailOf(error);
    return new SetTrackingProgramError(
      "invalido",
      detail ?? "Esta entidad no puede tener el programa de seguimiento.",
      detail,
    );
  }
  if (error instanceof ApiError && error.status === 403) {
    return new SetTrackingProgramError("sin_permiso", "Solo superadmin puede cambiar el programa de seguimiento.");
  }
  return new SetTrackingProgramError("desconocido", "No se pudo cambiar el programa de seguimiento.");
}

export function useSetTrackingProgram(
  orgId: number | string,
): UseMutationResult<Organization, SetTrackingProgramError, boolean> {
  const queryClient = useQueryClient();
  return useMutation<Organization, SetTrackingProgramError, boolean>({
    mutationFn: async (enabled) => {
      try {
        return await apiFetch<Organization>(ORGANIZATIONS.DETAIL(orgId), {
          method: "PATCH",
          body: { tracking_program_enabled: enabled },
        });
      } catch (error) {
        throw toSetTrackingProgramError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-organization", String(orgId)] });
    },
  });
}
