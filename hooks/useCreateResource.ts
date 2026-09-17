"use client";

/**
 * `POST /api/organizations/{org_id}/resources/` (`docs/PANEL.md` §7):
 * crea un recurso de la entidad. Solo titular/moderador
 * (`entities.permissions.puede(user, org, 'moderar')`). Con fichero manda
 * `multipart/form-data` (`buildResourcePayload`); el backend valida tamaño
 * (20 MB) y extensión antes de persistir (`validate_file`, §7.3) — 400 con
 * el detalle si el fichero no encaja, aunque el formulario ya valide en el
 * cliente primero (`lib/resources/validateFile.ts`).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { EntityResource, ResourceAudience, ResourceCategory, ResourceKind } from "@/lib/api/types";
import { buildResourcePayload, type ResourceFormInput } from "@/lib/resources/resourceFormData";

export type CreateResourceErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class CreateResourceError extends Error {
  readonly kind: CreateResourceErrorKind;

  constructor(kind: CreateResourceErrorKind, message: string) {
    super(message);
    this.name = "CreateResourceError";
    this.kind = kind;
  }
}

export type CreateResourceInput = ResourceFormInput &
  Required<Pick<ResourceFormInput, "title" | "category" | "kind" | "audience">> & {
    category: ResourceCategory;
    kind: ResourceKind;
    audience: ResourceAudience;
  };

export function useCreateResource(
  orgId: number | string,
): UseMutationResult<EntityResource, CreateResourceError, CreateResourceInput> {
  const queryClient = useQueryClient();

  return useMutation<EntityResource, CreateResourceError, CreateResourceInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<EntityResource>(ORGANIZATIONS.RESOURCES(orgId), {
          method: "POST",
          body: buildResourcePayload(input),
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          throw new CreateResourceError(
            "invalido",
            detailOf(error) ?? "Revisa los datos: alguno no es válido.",
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new CreateResourceError(
            "sin_permiso",
            "Solo titular o moderador pueden crear recursos.",
          );
        }
        throw new CreateResourceError("desconocido", "No se pudo crear el recurso.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-resources", orgId] });
    },
  });
}
