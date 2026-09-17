"use client";

/**
 * `GET`/`POST`/`DELETE /api/organizations/{id}/references/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §8): persona ↔ referente,
 * `titular`/`moderador`. Sin paginar de verdad (ver
 * `lib/api/types.ts::ReferenceList`). `POST` la usa ya
 * `hooks/useAssignReferent.ts` desde la ficha de persona (W3); este
 * fichero añade la lista y el alta/baja desde Configuración (W4a), sin
 * tocar aquel hook para no arriesgar sus tests.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { Reference, ReferenceList } from "@/lib/api/types";

export class OrgReferencesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrgReferencesError";
  }
}

export function useOrgReferences(
  orgId: number | string,
): UseQueryResult<ReferenceList, OrgReferencesError> {
  return useQuery<ReferenceList, OrgReferencesError>({
    queryKey: ["panel-org-references", orgId],
    queryFn: async () => {
      try {
        return await apiFetch<ReferenceList>(ORGANIZATIONS.REFERENCES(orgId));
      } catch {
        throw new OrgReferencesError("No se pudieron cargar los referentes de la entidad.");
      }
    },
  });
}

function invalidateReferences(
  queryClient: ReturnType<typeof useQueryClient>,
  orgId: number | string,
): void {
  queryClient.invalidateQueries({ queryKey: ["panel-org-references", orgId] });
  // La columna «Referente» del listado de personas y la ficha de cada
  // persona salen de otras dos familias, con filtros/periodo en la clave
  // (`usePeople`/`usePerson`): prefijo.
  queryClient.invalidateQueries({ queryKey: ["panel-people", orgId] });
  queryClient.invalidateQueries({ queryKey: ["panel-person", orgId] });
}

export interface CreateReferenceInput {
  user: number;
  referent_user: number;
}

export function useCreateOrgReference(
  orgId: number | string,
): UseMutationResult<Reference, OrgReferencesError, CreateReferenceInput> {
  const queryClient = useQueryClient();

  return useMutation<Reference, OrgReferencesError, CreateReferenceInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<Reference>(ORGANIZATIONS.REFERENCES(orgId), {
          method: "POST",
          body: input,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          throw new OrgReferencesError(
            detailOf(error) ??
              "Revisa los datos: esa persona ya tiene referente, o quien asignas no es referente.",
          );
        }
        throw new OrgReferencesError("No se pudo asignar el referente.");
      }
    },
    onSuccess: () => invalidateReferences(queryClient, orgId),
  });
}

export function useRemoveOrgReference(
  orgId: number | string,
): UseMutationResult<void, OrgReferencesError, number> {
  const queryClient = useQueryClient();

  return useMutation<void, OrgReferencesError, number>({
    mutationFn: async (userId) => {
      try {
        await apiFetch<void>(`${ORGANIZATIONS.REFERENCES(orgId)}?user_id=${userId}`, {
          method: "DELETE",
        });
      } catch {
        throw new OrgReferencesError("No se pudo quitar el referente.");
      }
    },
    onSuccess: () => invalidateReferences(queryClient, orgId),
  });
}
