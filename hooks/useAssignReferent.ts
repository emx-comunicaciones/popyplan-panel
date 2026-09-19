"use client";

/**
 * `POST /api/organizations/{id}/references/ {user, referent_user}`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §8): asigna un referente a una
 * persona de la entidad. Solo `titular`/`moderador` (la matriz ya lo
 * exige en el backend; el botón «Asignar referente» de la ficha de
 * persona lo oculta además en el cliente para esos dos roles). Invalida
 * la ficha de la persona y el listado tras asignar, para que el
 * `referent` mostrado se actualice sin recargar la página — la clave de
 * la ficha se invalida con `String(userId)` porque `usePerson` la
 * cachea con el `userId` string del parámetro de ruta de Next.js (mismo
 * mismatch string↔number que `useProgram`/`useProgramMutations`,
 * `typeof` distinto jamás empareja por prefijo).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { Reference } from "@/lib/api/types";

export type AssignReferentErrorKind = "invalido" | "sin_permiso" | "desconocido";

/**
 * `kind` (+ `detail`, el texto verbatim del backend cuando lo hay) es lo
 * que traduce `components/entidad/PersonSheet.tsx` (tarea 3 de i18n,
 * `lib/i18n/errorKindText.ts`) — este hook, plano `.ts`, no puede llamar
 * a `t()`, así que `message` sigue en español tal cual (compatibilidad de
 * los tests que ya lo comprueban).
 */
export class AssignReferentError extends Error {
  readonly kind: AssignReferentErrorKind;
  readonly detail?: string;

  constructor(kind: AssignReferentErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "AssignReferentError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toAssignReferentError(error: unknown): AssignReferentError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      const detail = detailOf(error);
      return new AssignReferentError(
        "invalido",
        detail ?? "No se pudo asignar el referente: revisa los datos.",
        detail,
      );
    }
    if (error.status === 403) {
      return new AssignReferentError("sin_permiso", "No tienes permiso para asignar referentes.");
    }
  }
  return new AssignReferentError("desconocido", "No se pudo asignar el referente.");
}

export interface AssignReferentInput {
  userId: number;
  referentUserId: number;
}

export function useAssignReferent(
  orgId: number | string,
): UseMutationResult<Reference, AssignReferentError, AssignReferentInput> {
  const queryClient = useQueryClient();

  return useMutation<Reference, AssignReferentError, AssignReferentInput>({
    mutationFn: async ({ userId, referentUserId }) => {
      try {
        return await apiFetch<Reference>(ORGANIZATIONS.REFERENCES(orgId), {
          method: "POST",
          body: { user: userId, referent_user: referentUserId },
        });
      } catch (error) {
        throw toAssignReferentError(error);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["panel-person", orgId, String(variables.userId)] });
      queryClient.invalidateQueries({ queryKey: ["panel-people", orgId] });
      // La tabla «Referencias» de Configuración lee esta clave
      // (`useOrgReferences`): sin invalidarla, el referente recién
      // asignado no aparecía allí.
      queryClient.invalidateQueries({ queryKey: ["panel-org-references", orgId] });
    },
  });
}
