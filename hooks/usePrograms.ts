"use client";

/**
 * `GET /api/panel/entidad/{org_id}/programs/` (`docs/PANEL.md` §12.2):
 * listado de programas de la entidad, `ver_panel` (cualquier rol con
 * acceso a la sección). Array plano (`ProgramListView.get` responde
 * `Response(ProgramSerializer(rows, many=True).data)`, sin paginador).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { PROGRAMS } from "@/lib/api/endpoints";
import type { Program } from "@/lib/api/types";

export class ProgramsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgramsError";
  }
}

export function usePrograms(orgId: number | string): UseQueryResult<Program[], ProgramsError> {
  return useQuery<Program[], ProgramsError>({
    queryKey: ["panel-programs", orgId],
    queryFn: async () => {
      try {
        return await apiFetch<Program[]>(PROGRAMS.LIST(orgId));
      } catch {
        throw new ProgramsError("No se pudieron cargar los programas.");
      }
    },
  });
}
