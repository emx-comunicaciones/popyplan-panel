"use client";

/**
 * `POST /api/communities/ {name, description?, visibility?,
 * code_of_conduct?, space, owner_org}` (`communities.services
 * .community_service.create_community`): crea una comunidad de la
 * propia entidad, de miembros (`space: 'members'`, botón «Nueva
 * comunidad» de `ComunidadesPanel.tsx`) o de familias (`space:
 * 'families'`, botón «Nueva comunidad de familias» de
 * `FamiliasPanel.tsx`, §8.1) — mismo endpoint general de comunidades,
 * generalizado desde `useCreateFamiliesCommunity` (que solo admitía
 * `space: 'families'`) para que Comunidades pudiera reutilizarlo sin
 * duplicar la mutación. `space` es obligatorio en el input, sin valor
 * por defecto: los dos llamantes lo declaran de forma explícita, así
 * nadie crea una comunidad sin decidir a qué espacio pertenece. `space`
 * no se puede cambiar después de crear la comunidad
 * (`validate_space`), y solo una comunidad con `owner_org` puede
 * marcarse `families` — sin `owner_org` el backend da 400 para esa
 * combinación, así que este hook siempre lo manda. Solo
 * titular/moderador (`entities.permissions.puede(user, org, 'moderar')`,
 * comprobado también por `CommunitySerializer.validate` para el resto de
 * campos de comunidad).
 *
 * Invalidación: el listado de comunidades de la entidad
 * (`panel-entity-communities`) se invalida siempre; el resumen de
 * Familias (`panel-families-summary`) solo cuando `space === 'families'`
 * — una comunidad de miembros no aparece en ese resumen, invalidarlo de
 * todos modos solo gastaría una petición sin cambiar nada.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { COMMUNITIES } from "@/lib/api/endpoints";
import type { CreateCommunityRequest, EntityCommunityRow } from "@/lib/api/types";

export type CreateCommunityErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class CreateCommunityError extends Error {
  readonly kind: CreateCommunityErrorKind;
  readonly detail?: string;

  constructor(kind: CreateCommunityErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "CreateCommunityError";
    this.kind = kind;
    this.detail = detail;
  }
}

export interface CreateCommunityInput {
  orgId: number | string;
  space: CreateCommunityRequest["space"];
  name: string;
  description?: string;
  visibility?: CreateCommunityRequest["visibility"];
  codeOfConduct?: string;
}

export function useCreateCommunity(): UseMutationResult<
  EntityCommunityRow,
  CreateCommunityError,
  CreateCommunityInput
> {
  const queryClient = useQueryClient();

  return useMutation<EntityCommunityRow, CreateCommunityError, CreateCommunityInput>({
    mutationFn: async ({ orgId, space, name, description, visibility, codeOfConduct }) => {
      const body: CreateCommunityRequest = {
        name,
        description,
        visibility,
        code_of_conduct: codeOfConduct,
        space,
        owner_org: typeof orgId === "string" ? Number(orgId) : orgId,
      };
      try {
        return await apiFetch<EntityCommunityRow>(COMMUNITIES.LIST(), {
          method: "POST",
          body,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new CreateCommunityError("invalido", detail ?? "Revisa los datos: alguno no es válido.", detail);
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new CreateCommunityError("sin_permiso", "Solo titular o moderador pueden crear una comunidad.");
        }
        throw new CreateCommunityError("desconocido", "No se pudo crear la comunidad.");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["panel-entity-communities", variables.orgId] });
      if (variables.space === "families") {
        queryClient.invalidateQueries({ queryKey: ["panel-families-summary", variables.orgId] });
      }
    },
  });
}
