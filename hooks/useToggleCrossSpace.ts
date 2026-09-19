"use client";

/**
 * `PATCH /api/communities/{id}/ {allow_cross_space}` (`docs/PANEL.md`
 * §8.1): activa o desactiva el cruce de espacios de una comunidad de
 * familias (o de miembros). Solo quien puede moderar la entidad
 * (`entities.permissions.puede(user, org, 'moderar')`, es decir
 * titular/moderador) puede tocarlo — `validate_allow_cross_space` en el
 * backend; el resto de roles con acceso a Familias (`dinamizador`) solo
 * ve el estado, sin el control (`FamiliasPanel.tsx`). Invalida el resumen
 * de Familias y el listado general de comunidades de la entidad tras
 * tener éxito, para que ambos reflejen el nuevo `allow_cross_space` sin
 * recargar la página.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { COMMUNITIES } from "@/lib/api/endpoints";
import type { EntityCommunityRow } from "@/lib/api/types";

export type ToggleCrossSpaceErrorKind = "sin_permiso" | "desconocido";

export class ToggleCrossSpaceError extends Error {
  readonly kind: ToggleCrossSpaceErrorKind;

  constructor(kind: ToggleCrossSpaceErrorKind, message: string) {
    super(message);
    this.name = "ToggleCrossSpaceError";
    this.kind = kind;
  }
}

export interface ToggleCrossSpaceInput {
  orgId: number | string;
  communityId: string;
  allowCrossSpace: boolean;
}

export function useToggleCrossSpace(): UseMutationResult<
  EntityCommunityRow,
  ToggleCrossSpaceError,
  ToggleCrossSpaceInput
> {
  const queryClient = useQueryClient();

  return useMutation<EntityCommunityRow, ToggleCrossSpaceError, ToggleCrossSpaceInput>({
    mutationFn: async ({ communityId, allowCrossSpace }) => {
      try {
        return await apiFetch<EntityCommunityRow>(COMMUNITIES.DETAIL(communityId), {
          method: "PATCH",
          body: { allow_cross_space: allowCrossSpace },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new ToggleCrossSpaceError(
            "sin_permiso",
            "Solo titular o moderador pueden cambiar la separación de espacios.",
          );
        }
        throw new ToggleCrossSpaceError("desconocido", "No se pudo cambiar la separación de espacios.");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["panel-families-summary", variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ["panel-entity-communities", variables.orgId] });
    },
  });
}
