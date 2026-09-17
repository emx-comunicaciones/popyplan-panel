"use client";

/**
 * `POST /api/communities/ {name, description?, visibility?,
 * code_of_conduct?, space:'families', owner_org}` (`docs/PANEL.md` §8.1,
 * `communities.services.community_service.create_community`): crea una
 * comunidad de familias de la propia entidad. `space` no se puede
 * cambiar después de crear la comunidad (`validate_space`), y solo una
 * comunidad con `owner_org` puede marcarse `families` — sin `owner_org`
 * el backend da 400, así que este hook siempre lo manda. Solo
 * titular/moderador (`entities.permissions.puede(user, org, 'moderar')`,
 * comprobado también por `CommunitySerializer.validate` para el resto de
 * campos de comunidad).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { COMMUNITIES } from "@/lib/api/endpoints";
import type { CreateFamiliesCommunityRequest, EntityCommunityRow } from "@/lib/api/types";

export type CreateFamiliesCommunityErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class CreateFamiliesCommunityError extends Error {
  readonly kind: CreateFamiliesCommunityErrorKind;

  constructor(kind: CreateFamiliesCommunityErrorKind, message: string) {
    super(message);
    this.name = "CreateFamiliesCommunityError";
    this.kind = kind;
  }
}

export interface CreateFamiliesCommunityInput {
  orgId: number | string;
  name: string;
  description?: string;
  visibility?: CreateFamiliesCommunityRequest["visibility"];
  codeOfConduct?: string;
}

export function useCreateFamiliesCommunity(): UseMutationResult<
  EntityCommunityRow,
  CreateFamiliesCommunityError,
  CreateFamiliesCommunityInput
> {
  const queryClient = useQueryClient();

  return useMutation<EntityCommunityRow, CreateFamiliesCommunityError, CreateFamiliesCommunityInput>({
    mutationFn: async ({ orgId, name, description, visibility, codeOfConduct }) => {
      const body: CreateFamiliesCommunityRequest = {
        name,
        description,
        visibility,
        code_of_conduct: codeOfConduct,
        space: "families",
        owner_org: typeof orgId === "string" ? Number(orgId) : orgId,
      };
      try {
        return await apiFetch<EntityCommunityRow>(COMMUNITIES.LIST(), {
          method: "POST",
          body,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          throw new CreateFamiliesCommunityError(
            "invalido",
            detailOf(error) ?? "Revisa los datos: alguno no es válido.",
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new CreateFamiliesCommunityError(
            "sin_permiso",
            "Solo titular o moderador pueden crear una comunidad de familias.",
          );
        }
        throw new CreateFamiliesCommunityError("desconocido", "No se pudo crear la comunidad de familias.");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["panel-families-summary", variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ["panel-entity-communities", variables.orgId] });
    },
  });
}
