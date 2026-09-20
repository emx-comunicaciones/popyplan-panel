"use client";

/**
 * `PATCH /api/organizations/{id}/` (`docs/SEGURIDAD_Y_MODERACION.md` §8):
 * lista blanca de campos editables por el `titular`
 * (`description, contact_email, contact_phone, help_phone, website,
 * primary_color, secondary_color, on_call_user`) — `parent` queda fuera
 * (solo `superadmin`, y nunca junto al resto en la misma petición).
 * `logo` también está en la lista blanca y el contrato real espera
 * `multipart/form-data` (un fichero, no una URL de texto): con `logo`
 * en la entrada, `buildOrganizationPayload` construye un `FormData` con
 * el resto de campos como cadenas (mismo patrón que
 * `lib/resources/resourceFormData.ts`, y `apiFetch` ya manda un
 * `FormData` tal cual); sin `logo`, JSON normal, como siempre.
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
  readonly detail?: string;

  constructor(kind: UpdateOrganizationErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "UpdateOrganizationError";
    this.kind = kind;
    this.detail = detail;
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
  /**
   * Código INE de la sede. El `titular` sí la edita desde Configuración
   * (spec §2.3: «`place` sí lo puede editar el titular de la entidad en
   * su configuración, porque es un dato propio»), a diferencia de
   * `admin_level`/`territory_*`, que son solo de plataforma y van por
   * `hooks/useSetOrganizationTerritory.ts`.
   */
  place?: string | null;
  /**
   * Logo nuevo (`Organization.logo`, `ImageField`). Solo se manda cuando
   * la persona ha elegido un fichero; validado antes con
   * `lib/organizations/validateLogo.ts`. Fuerza el cuerpo `multipart`.
   */
  logo?: File;
}

/**
 * Cuerpo real de la petición: `FormData` si hay logo (cada campo como
 * cadena; `null` viaja como cadena vacía, que DRF interpreta como
 * «vaciar» en un campo `allow_blank`), o el objeto JSON tal cual.
 */
export function buildOrganizationPayload(input: UpdateOrganizationInput): FormData | UpdateOrganizationInput {
  if (!input.logo) return input;
  const formData = new FormData();
  for (const [field, value] of Object.entries(input)) {
    if (field === "logo" || value === undefined) continue;
    formData.append(field, value === null ? "" : String(value));
  }
  formData.append("logo", input.logo);
  return formData;
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
          body: buildOrganizationPayload(input),
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new UpdateOrganizationError(
            "invalido",
            detail ?? "Revisa los datos: alguno no es válido.",
            detail,
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
      // `String(orgId)`: misma clave que construye `useOrganization`, que
      // también normaliza — sin esto, invalidar con un `orgId` de otro
      // tipo (number vs. string) nunca encuentra la entrada cacheada.
      queryClient.invalidateQueries({ queryKey: ["panel-organization", String(orgId)] });
      // M4 de la revisión final de rama: la columna «Sede» de
      // `EntidadesTable` lee `["panel-organizations", …]` — sin esto, el
      // listado se quedaba con la sede vieja tras editarla desde la
      // ficha o desde Configuración, hasta recargar la página a mano.
      // Mismo patrón que ya sigue `useSetOrganizationTerritory`.
      queryClient.invalidateQueries({ queryKey: ["panel-organizations"] });
    },
  });
}
