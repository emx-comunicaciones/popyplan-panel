"use client";

/**
 * `GET /api/panel/entidad/{org_id}/programs/{program_id}/` (`docs/PANEL.md`
 * §12.2): ficha de un programa, `ver_panel`. Un 403 (sin ese permiso, o
 * entidad inexistente — `PuedeEnEntidad` no distingue el motivo) y un 404
 * (programa inexistente en esa entidad) se traducen a `ProgramError` con
 * un `kind` tipado.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { PROGRAMS } from "@/lib/api/endpoints";
import type { Program } from "@/lib/api/types";

export type ProgramErrorKind = "sin_acceso" | "no_encontrado" | "desconocido";

export class ProgramError extends Error {
  readonly kind: ProgramErrorKind;

  constructor(kind: ProgramErrorKind, message: string) {
    super(message);
    this.name = "ProgramError";
    this.kind = kind;
  }
}

function toProgramError(error: unknown): ProgramError {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return new ProgramError("sin_acceso", "No tienes acceso a este programa.");
    }
    if (error.status === 404) {
      return new ProgramError("no_encontrado", "Este programa no existe.");
    }
  }
  return new ProgramError("desconocido", "No se pudo cargar el programa.");
}

export function useProgram(
  orgId: number | string,
  programId: number | string,
): UseQueryResult<Program, ProgramError> {
  return useQuery<Program, ProgramError>({
    queryKey: ["panel-program", orgId, programId],
    queryFn: async () => {
      try {
        return await apiFetch<Program>(PROGRAMS.DETAIL(orgId, programId));
      } catch (error) {
        throw toProgramError(error);
      }
    },
  });
}
