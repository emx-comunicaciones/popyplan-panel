"use client";

/**
 * `PATCH /api/organizations/{org_id}/resources/{resource_id}/`
 * (`docs/PANEL.md` §7): edita un recurso existente. Solo
 * titular/moderador. Edición parcial: solo los campos presentes en
 * `ResourceFormInput` viajan (`buildResourcePayload`); si el formulario no
 * toca el fichero, no se manda `file` y el recurso conserva el que tenía.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { EntityResource } from "@/lib/api/types";
import { buildResourcePayload, type ResourceFormInput } from "@/lib/resources/resourceFormData";

export type UpdateResourceErrorKind = "invalido" | "sin_permiso" | "no_encontrado" | "desconocido";

export class UpdateResourceError extends Error {
  readonly kind: UpdateResourceErrorKind;

  constructor(kind: UpdateResourceErrorKind, message: string) {
    super(message);
    this.name = "UpdateResourceError";
    this.kind = kind;
  }
}

export interface UpdateResourceInput extends ResourceFormInput {
  resourceId: number | string;
}

export function useUpdateResource(
  orgId: number | string,
): UseMutationResult<EntityResource, UpdateResourceError, UpdateResourceInput> {
  const queryClient = useQueryClient();

  return useMutation<EntityResource, UpdateResourceError, UpdateResourceInput>({
    mutationFn: async ({ resourceId, ...fields }) => {
      try {
        return await apiFetch<EntityResource>(ORGANIZATIONS.RESOURCE(orgId, resourceId), {
          method: "PATCH",
          body: buildResourcePayload(fields),
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          throw new UpdateResourceError(
            "invalido",
            detailOf(error) ?? "Revisa los datos: alguno no es válido.",
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new UpdateResourceError(
            "sin_permiso",
            "Solo titular o moderador pueden editar recursos.",
          );
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new UpdateResourceError("no_encontrado", "Este recurso no existe.");
        }
        throw new UpdateResourceError("desconocido", "No se pudo guardar el recurso.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-resources", orgId] });
    },
  });
}
