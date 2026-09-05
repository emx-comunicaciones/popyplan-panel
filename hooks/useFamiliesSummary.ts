"use client";

/**
 * `GET /api/panel/entidad/{org_id}/families/` (`docs/PANEL.md` §8.3,
 * tarea de cierre P6): resumen del espacio POP Familias de la entidad —
 * sus comunidades `space='families'`, cuánta gente hay en ellas, próximas
 * actividades y últimos anuncios/recursos dirigidos a ese espacio. Mismo
 * permiso que el resto de vistas de resumen del panel (`ver_panel`):
 * titular, moderador, dinamizador, analista y referente — nunca 404,
 * incluso sin comunidades de familias (las cinco claves vuelven vacías).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { PANEL } from "@/lib/api/endpoints";
import type { FamiliesSummary } from "@/lib/api/types";

export class FamiliesSummaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FamiliesSummaryError";
  }
}

export function useFamiliesSummary(
  orgId: number | string,
): UseQueryResult<FamiliesSummary, FamiliesSummaryError> {
  return useQuery<FamiliesSummary, FamiliesSummaryError>({
    queryKey: ["panel-families-summary", orgId],
    queryFn: async () => {
      try {
        return await apiFetch<FamiliesSummary>(PANEL.FAMILIES(orgId));
      } catch {
        throw new FamiliesSummaryError("No se pudo cargar el resumen de Familias.");
      }
    },
  });
}
