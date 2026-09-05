"use client";

/**
 * `GET /api/organizations/{id}/` (`docs/SEGURIDAD_Y_MODERACION.md` §8):
 * ficha de la entidad. El layout ya la pide en el servidor para la
 * cabecera; Configuración y Guardia (tarea W4a) la vuelven a pedir desde
 * el cliente porque necesitan reaccionar a sus propias mutaciones
 * (`useUpdateOrganization`) sin recargar la página.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { Organization } from "@/lib/api/types";

export class OrganizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationError";
  }
}

export function useOrganization(orgId: number | string): UseQueryResult<Organization, OrganizationError> {
  return useQuery<Organization, OrganizationError>({
    queryKey: ["panel-organization", orgId],
    queryFn: async () => {
      try {
        return await apiFetch<Organization>(ORGANIZATIONS.DETAIL(orgId));
      } catch {
        throw new OrganizationError("No se pudo cargar la ficha de la entidad.");
      }
    },
  });
}
