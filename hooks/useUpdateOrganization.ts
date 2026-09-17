"use client";

/**
 * `PATCH /api/organizations/{id}/` (`docs/SEGURIDAD_Y_MODERACION.md` §8):
 * lista blanca de campos editables por el `titular`
 * (`description, contact_email, contact_phone, help_phone, website,
 * primary_color, secondary_color, on_call_user`) — `parent` queda fuera
 * (solo `superadmin`, y nunca junto al resto en la misma petición).
 * `logo` también está en la lista blanca pero el contrato real espera
 * `multipart/form-data` (fichero), no una URL de texto: esta mutación
 * solo cubre los campos de texto/color/guardia; ver «Desviaciones» del
 * informe de esta tarea sobre el logo.
 *
 * La usan tanto Configuración (datos, colores) como Guardia (`on_call_user`,
 * `help_phone`).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { Organization } from "@/lib/api/types";

export type UpdateOrganizationErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class UpdateOrganizationError extends Error {
  readonly kind: UpdateOrganizationErrorKind;

  constructor(kind: UpdateOrganizationErrorKind, message: string) {
    super(message);
    this.name = "UpdateOrganizationError";
    this.kind = kind;
  }
}

export interface UpdateOrganizationInput {
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  help_phone?: string;
  website?: string;
  primary_color?: string;
  secondary_color?: string;
  on_call_user?: number | null;
}

export function useUpdateOrganization(
  orgId: number | string,
): UseMutationResult<Organization, UpdateOrganizationError, UpdateOrganizationInput> {
  const queryClient = useQueryClient();

  return useMutation<Organization, UpdateOrganizationError, UpdateOrganizationInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<Organization>(ORGANIZATIONS.DETAIL(orgId), {
          method: "PATCH",
          body: input,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          throw new UpdateOrganizationError(
            "invalido",
            detailOf(error) ?? "Revisa los datos: alguno no es válido.",
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new UpdateOrganizationError(
            "sin_permiso",
            "Solo el titular puede editar la ficha de la entidad.",
          );
        }
        throw new UpdateOrganizationError("desconocido", "No se pudo guardar la ficha de la entidad.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-organization", orgId] });
    },
  });
}
