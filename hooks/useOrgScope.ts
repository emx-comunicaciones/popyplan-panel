"use client";

/**
 * `POST /api/organizations/{id}/scope/` (`docs/SEGURIDAD_Y_MODERACION.md`
 * §8): amplía el ámbito INE de la entidad con municipios sueltos
 * (`places`), o expandiendo una comarca o provincia entera. Exactamente
 * una de las tres claves por petición (el backend responde 400 si falta).
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { OrgScopeRequest, OrgScopeResponse } from "@/lib/api/types";

export class OrgScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrgScopeError";
  }
}

export function useOrgScope(
  orgId: number | string,
): UseMutationResult<OrgScopeResponse, OrgScopeError, OrgScopeRequest> {
  return useMutation<OrgScopeResponse, OrgScopeError, OrgScopeRequest>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<OrgScopeResponse>(ORGANIZATIONS.SCOPE(orgId), {
          method: "POST",
          body: input,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          throw new OrgScopeError("Indica municipios, comarca o provincia.");
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new OrgScopeError("Solo el titular puede ampliar el ámbito de la entidad.");
        }
        throw new OrgScopeError("No se pudo ampliar el ámbito de la entidad.");
      }
    },
  });
}
