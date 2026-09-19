"use client";

/**
 * `POST /api/organizations/{id}/scope/` (`docs/SEGURIDAD_Y_MODERACION.md`
 * §8): amplía el ámbito INE de la entidad con municipios sueltos
 * (`places`), o expandiendo una comarca o provincia entera. Exactamente
 * una de las tres claves por petición (el backend responde 400 si falta).
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { OrgScopeRequest, OrgScopeResponse } from "@/lib/api/types";

export type OrgScopeErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class OrgScopeError extends Error {
  readonly kind: OrgScopeErrorKind;
  readonly detail?: string;

  constructor(kind: OrgScopeErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "OrgScopeError";
    this.kind = kind;
    this.detail = detail;
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
          const detail = detailOf(error);
          throw new OrgScopeError("invalido", detail ?? "Indica municipios, comarca o provincia.", detail);
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new OrgScopeError("sin_permiso", "Solo el titular puede ampliar el ámbito de la entidad.");
        }
        throw new OrgScopeError("desconocido", "No se pudo ampliar el ámbito de la entidad.");
      }
    },
  });
}
