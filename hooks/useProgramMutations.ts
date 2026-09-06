"use client";

/**
 * Escritura de programas (`docs/PANEL.md` §12.2-§12.3): crear, editar,
 * activar y cerrar, todas `gestionar_programas` (`titular`/`moderador`,
 * `entities/permissions.py`). Los errores de validación (400) y de
 * transición de estado (409) se traducen **literalmente** al mensaje que
 * manda el backend cuando lo trae (`ends_on`, «Un programa cerrado no se
 * modifica.»…) en vez de uno genérico — el brief exige que el mensaje del
 * cliente coincida con el del backend.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { PROGRAMS } from "@/lib/api/endpoints";
import type { Program, ProgramWriteFields } from "@/lib/api/types";

export type ProgramMutationErrorKind =
  | "invalido"
  | "sin_permiso"
  | "no_encontrado"
  | "conflicto"
  | "desconocido";

export class ProgramMutationError extends Error {
  readonly kind: ProgramMutationErrorKind;

  constructor(kind: ProgramMutationErrorKind, message: string) {
    super(message);
    this.name = "ProgramMutationError";
    this.kind = kind;
  }
}

/**
 * `ProgramInputSerializer`/`ProgramCloseSerializer` (`programs/
 * serializers.py`) devuelven sus errores de campo como
 * `{campo: ["mensaje"]}` (DRF estándar), nunca `{detail: "..."}` — a
 * diferencia de los 409 de transición, que sí llevan `{detail: "..."}`
 * (`programs/viewsets.py`, `TransicionInvalida`). Esta función cubre las
 * dos formas, con `detail` primero por si algún día coinciden.
 */
function detailOf(error: ApiError): string | undefined {
  const body = error.body as Record<string, unknown> | null;
  if (!body) return undefined;
  if (typeof body.detail === "string") return body.detail;
  for (const value of Object.values(body)) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return undefined;
}

function toProgramMutationError(error: unknown, fallback: string): ProgramMutationError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return new ProgramMutationError(
        "invalido",
        detailOf(error) ?? "Revisa los datos: alguno no es válido.",
      );
    }
    if (error.status === 403) {
      return new ProgramMutationError(
        "sin_permiso",
        "Solo titular o moderador pueden gestionar programas.",
      );
    }
    if (error.status === 404) {
      return new ProgramMutationError("no_encontrado", "Este programa no existe.");
    }
    if (error.status === 409) {
      return new ProgramMutationError(
        "conflicto",
        detailOf(error) ?? "Este programa no admite esa acción.",
      );
    }
  }
  return new ProgramMutationError("desconocido", fallback);
}

function invalidatePrograms(
  queryClient: ReturnType<typeof useQueryClient>,
  orgId: number | string,
  programId?: number | string,
): void {
  queryClient.invalidateQueries({ queryKey: ["panel-programs", orgId] });
  if (programId !== undefined) {
    queryClient.invalidateQueries({ queryKey: ["panel-program", orgId, programId] });
  }
}

export type CreateProgramInput = ProgramWriteFields;

/** `POST /api/panel/entidad/{org_id}/programs/`: nace en `draft`. */
export function useCreateProgram(
  orgId: number | string,
): UseMutationResult<Program, ProgramMutationError, CreateProgramInput> {
  const queryClient = useQueryClient();

  return useMutation<Program, ProgramMutationError, CreateProgramInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<Program>(PROGRAMS.LIST(orgId), { method: "POST", body: input });
      } catch (error) {
        throw toProgramMutationError(error, "No se pudo crear el programa.");
      }
    },
    onSuccess: () => invalidatePrograms(queryClient, orgId),
  });
}

export interface UpdateProgramInput extends Partial<ProgramWriteFields> {
  programId: number | string;
}

/** `PATCH /api/panel/entidad/{org_id}/programs/{program_id}/`: `draft`/`active`, nunca `closed` (409). */
export function useUpdateProgram(
  orgId: number | string,
): UseMutationResult<Program, ProgramMutationError, UpdateProgramInput> {
  const queryClient = useQueryClient();

  return useMutation<Program, ProgramMutationError, UpdateProgramInput>({
    mutationFn: async ({ programId, ...fields }) => {
      try {
        return await apiFetch<Program>(PROGRAMS.DETAIL(orgId, programId), {
          method: "PATCH",
          body: fields,
        });
      } catch (error) {
        throw toProgramMutationError(error, "No se pudo guardar el programa.");
      }
    },
    onSuccess: (_data, variables) => invalidatePrograms(queryClient, orgId, variables.programId),
  });
}

/** `POST .../activate/`: `draft -> active`, sin cuerpo. */
export function useActivateProgram(
  orgId: number | string,
): UseMutationResult<Program, ProgramMutationError, number | string> {
  const queryClient = useQueryClient();

  return useMutation<Program, ProgramMutationError, number | string>({
    mutationFn: async (programId) => {
      try {
        return await apiFetch<Program>(PROGRAMS.ACTIVATE(orgId, programId), { method: "POST" });
      } catch (error) {
        throw toProgramMutationError(error, "No se pudo activar el programa.");
      }
    },
    onSuccess: (_data, programId) => invalidatePrograms(queryClient, orgId, programId),
  });
}

export interface CloseProgramInput {
  programId: number | string;
  closingNotes: string;
}

/** `POST .../close/ {closing_notes}`: `active -> closed`. */
export function useCloseProgram(
  orgId: number | string,
): UseMutationResult<Program, ProgramMutationError, CloseProgramInput> {
  const queryClient = useQueryClient();

  return useMutation<Program, ProgramMutationError, CloseProgramInput>({
    mutationFn: async ({ programId, closingNotes }) => {
      try {
        return await apiFetch<Program>(PROGRAMS.CLOSE(orgId, programId), {
          method: "POST",
          body: { closing_notes: closingNotes },
        });
      } catch (error) {
        throw toProgramMutationError(error, "No se pudo cerrar el programa.");
      }
    },
    onSuccess: (_data, variables) => invalidatePrograms(queryClient, orgId, variables.programId),
  });
}
