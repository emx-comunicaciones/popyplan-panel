"use client";

/**
 * `POST /api/organizations/{org_id}/invitations/import/?dry_run=`
 * (`docs/PANEL.md` §3b.3, tarea W3b): sube un `.csv`/`.xlsx` como
 * multipart `file`. `dry_run=true` calcula el resultado sin escribir
 * nada (ni invitaciones ni correos); `dry_run=false` importa de verdad y
 * solo entonces invalida el listado de personas/invitaciones. El cuerpo
 * de la respuesta (`ImportPeopleResult`) es un tipo manual —
 * `docs/schema.yaml` no declara bien esta ruta, ver `lib/api/types.ts`.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { ImportPeopleResult } from "@/lib/api/types";

export type ImportPeopleErrorKind = "invalido" | "sin_permiso" | "desconocido";

export class ImportPeopleError extends Error {
  readonly kind: ImportPeopleErrorKind;

  constructor(kind: ImportPeopleErrorKind, message: string) {
    super(message);
    this.name = "ImportPeopleError";
    this.kind = kind;
  }
}

function detailOf(error: ApiError): string | undefined {
  const body = error.body as { detail?: unknown } | null;
  return typeof body?.detail === "string" ? body.detail : undefined;
}

export interface ImportPeopleInput {
  file: File;
  dryRun: boolean;
}

export function useImportPeople(
  orgId: number | string,
): UseMutationResult<ImportPeopleResult, ImportPeopleError, ImportPeopleInput> {
  const queryClient = useQueryClient();

  return useMutation<ImportPeopleResult, ImportPeopleError, ImportPeopleInput>({
    mutationFn: async ({ file, dryRun }) => {
      const formData = new FormData();
      formData.append("file", file);
      try {
        return await apiFetch<ImportPeopleResult>(
          `${ORGANIZATIONS.INVITATIONS_IMPORT(orgId)}?dry_run=${dryRun ? "true" : "false"}`,
          { method: "POST", body: formData },
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          throw new ImportPeopleError(
            "invalido",
            detailOf(error) ?? "Revisa el fichero: alguna fila no es válida.",
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new ImportPeopleError("sin_permiso", "Solo titular o moderador pueden importar personas.");
        }
        throw new ImportPeopleError("desconocido", "No se pudo importar el fichero.");
      }
    },
    onSuccess: (_data, variables) => {
      if (!variables.dryRun) {
        queryClient.invalidateQueries({ queryKey: ["panel-people", orgId] });
        queryClient.invalidateQueries({ queryKey: ["panel-invitations", orgId] });
      }
    },
  });
}
