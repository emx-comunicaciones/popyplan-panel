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
    // `String(orgId)`: quien pide la ficha puede recibir el id como
    // parámetro de ruta (string, `EntidadDetail`/`DatosTab`) o como
    // `Organization.id` (number, cualquier mutación que invalide esta
    // clave tras guardar). Sin normalizar, `["panel-organization", 9]` y
    // `["panel-organization", "9"]` son dos entradas de caché distintas
    // para TanStack Query y una invalidación nunca encuentra la otra —
    // mismo bug de clase que `useProgram`/`useAssignReferent`
    // (`CLAUDE.md`, «Bug real encontrado por `e2e/programas.spec.ts`»).
    queryKey: ["panel-organization", String(orgId)],
    queryFn: async () => {
      try {
        return await apiFetch<Organization>(ORGANIZATIONS.DETAIL(orgId));
      } catch {
        throw new OrganizationError("No se pudo cargar la ficha de la entidad.");
      }
    },
  });
}
