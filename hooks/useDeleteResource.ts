"use client";

/**
 * `DELETE /api/organizations/{org_id}/resources/{resource_id}/`
 * (`docs/PANEL.md` §7): retira un recurso. Solo titular/moderador.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { ORGANIZATIONS } from "@/lib/api/endpoints";

export type DeleteResourceErrorKind = "sin_permiso" | "no_encontrado" | "desconocido";

export class DeleteResourceError extends Error {
  readonly kind: DeleteResourceErrorKind;

  constructor(kind: DeleteResourceErrorKind, message: string) {
    super(message);
    this.name = "DeleteResourceError";
    this.kind = kind;
  }
}

export function useDeleteResource(
  orgId: number | string,
): UseMutationResult<void, DeleteResourceError, number | string> {
  const queryClient = useQueryClient();

  return useMutation<void, DeleteResourceError, number | string>({
    mutationFn: async (resourceId) => {
      try {
        await apiFetch<void>(ORGANIZATIONS.RESOURCE(orgId, resourceId), { method: "DELETE" });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new DeleteResourceError(
            "sin_permiso",
            "Solo titular o moderador pueden eliminar recursos.",
          );
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new DeleteResourceError("no_encontrado", "Este recurso no existe.");
        }
        throw new DeleteResourceError("desconocido", "No se pudo eliminar el recurso.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-resources", orgId] });
    },
  });
}
