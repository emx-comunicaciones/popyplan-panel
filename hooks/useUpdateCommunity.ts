"use client";

/**
 * `PATCH /api/communities/{id}/ {name?, description?, visibility?,
 * code_of_conduct?}` (`communities/permissions.py::Community.can_manage`
 * → `entities.permissions.puede(user, owner_org, 'moderar')`, solo
 * titular/moderador): «Editar comunidad» del propietario
 * (`components/entidad/EditarComunidadDialog.tsx`, encargo «no puedo
 * editar la comunidad que he creado»). **`space` nunca se manda**: el
 * backend rechaza cambiarlo tras crear la comunidad (`validate_space`,
 * mismo motivo por el que `hooks/useCreateCommunity.ts` no lo deja
 * elegir dos veces) — el formulario de edición no lo ofrece.
 *
 * Invalidación: el listado de comunidades de la entidad
 * (`panel-entity-communities`) y la propia ficha
 * (`panel-community`, `hooks/useCommunity.ts`) se invalidan siempre; el
 * resumen de Familias (`panel-families-summary`) solo si la comunidad
 * editada es de ese espacio (`space: 'families'`) — mismo criterio que
 * `useCreateCommunity`, una comunidad de miembros no aparece ahí.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { COMMUNITIES } from "@/lib/api/endpoints";
import type { CreateCommunityRequest, EntityCommunityRow, UpdateCommunityRequest } from "@/lib/api/types";

export type UpdateCommunityErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class UpdateCommunityError extends Error {
  readonly kind: UpdateCommunityErrorKind;
  readonly detail?: string;

  constructor(kind: UpdateCommunityErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "UpdateCommunityError";
    this.kind = kind;
    this.detail = detail;
  }
}

export interface UpdateCommunityInput {
  orgId: number | string;
  communityId: string;
  space: CreateCommunityRequest["space"];
  name?: string;
  description?: string;
  visibility?: CreateCommunityRequest["visibility"];
  codeOfConduct?: string;
}

export function useUpdateCommunity(): UseMutationResult<
  EntityCommunityRow,
  UpdateCommunityError,
  UpdateCommunityInput
> {
  const queryClient = useQueryClient();

  return useMutation<EntityCommunityRow, UpdateCommunityError, UpdateCommunityInput>({
    mutationFn: async ({ communityId, name, description, visibility, codeOfConduct }) => {
      const body: UpdateCommunityRequest = {
        name,
        description,
        visibility,
        code_of_conduct: codeOfConduct,
      };
      try {
        return await apiFetch<EntityCommunityRow>(COMMUNITIES.DETAIL(communityId), {
          method: "PATCH",
          body,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new UpdateCommunityError("invalido", detail ?? "Revisa los datos: alguno no es válido.", detail);
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new UpdateCommunityError("sin_permiso", "Solo titular o moderador pueden editar una comunidad.");
        }
        throw new UpdateCommunityError("desconocido", "No se pudieron guardar los cambios en la comunidad.");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["panel-entity-communities", variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ["panel-community", variables.communityId] });
      if (variables.space === "families") {
        queryClient.invalidateQueries({ queryKey: ["panel-families-summary", variables.orgId] });
      }
    },
  });
}
