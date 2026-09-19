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
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { ImportPeopleResult } from "@/lib/api/types";

export type ImportPeopleErrorKind = "invalido" | "sin_permiso" | "desconocido";

/**
 * `kind` (+ `detail`, el texto verbatim del backend cuando lo hay) es lo
 * que traduce `components/people/ImportPeopleDialog.tsx` (tarea 3 de
 * i18n, `lib/i18n/errorKindText.ts`) — este hook, plano `.ts`, no puede
 * llamar a `t()`, así que `message` sigue en español tal cual
 * (compatibilidad de los tests que ya lo comprueban).
 */
export class ImportPeopleError extends Error {
  readonly kind: ImportPeopleErrorKind;
  readonly detail?: string;

  constructor(kind: ImportPeopleErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "ImportPeopleError";
    this.kind = kind;
    this.detail = detail;
  }
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
          const detail = detailOf(error);
          throw new ImportPeopleError(
            "invalido",
            detail ?? "Revisa el fichero: alguna fila no es válida.",
            detail,
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
