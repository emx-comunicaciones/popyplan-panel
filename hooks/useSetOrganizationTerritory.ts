"use client";

/**
 * `PATCH /api/organizations/{id}/ {admin_level, territory_kind,
 * territory_code}` (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §2.3: solo
 * `superadmin`, desde la ficha de entidad, «como hoy cambia `parent`»).
 *
 * Manda **solo** esos tres campos, igual que `useSetOrganizationParent`
 * manda solo `parent`: el backend distingue quién puede tocar qué
 * mirando qué campos trae el cuerpo, así que mezclarlos con la lista
 * blanca del titular provocaría un 403 en una petición que por separado
 * sí pasa.
 *
 * `territory_kind: ""` con `territory_code: ""` limpia el territorio
 * (§2.2, `set_territory(org, '', '')`).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { AdminLevel, Organization, TerritoryKind } from "@/lib/api/types";

import { OrganizationsError } from "./useOrganizations";

export interface SetOrganizationTerritoryInput {
  admin_level: AdminLevel;
  territory_kind: TerritoryKind;
  territory_code: string;
}

export function useSetOrganizationTerritory(
  orgId: number | string,
): UseMutationResult<Organization, OrganizationsError, SetOrganizationTerritoryInput> {
  const queryClient = useQueryClient();

  return useMutation<Organization, OrganizationsError, SetOrganizationTerritoryInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<Organization>(ORGANIZATIONS.DETAIL(orgId), {
          method: "PATCH",
          body: input,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new OrganizationsError(
            detail ?? "Revisa el territorio: alguno de los datos no es válido.",
            "invalido",
            detail,
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new OrganizationsError("Solo superadmin declara el territorio.", "sin_permiso");
        }
        throw new OrganizationsError("No se pudo guardar el territorio.", "desconocido");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-organizations"] });
      // `String(orgId)`: misma clave que construye `useOrganization` — sin
      // normalizar, invalidar con un `orgId` de otro tipo (p. ej. el
      // number de `Organization.id` cuando `useOrganization` cachea con
      // el string del parámetro de ruta) nunca encontraba la entrada, y
      // la ficha se quedaba obsoleta hasta recargar la página a mano
      // (fix round 1, misma clase de bug que `useProgram`/
      // `useAssignReferent`).
      queryClient.invalidateQueries({ queryKey: ["panel-organization", String(orgId)] });
    },
  });
}
