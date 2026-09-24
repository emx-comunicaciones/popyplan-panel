"use client";

/**
 * `GET /api/panel/entidad/{org_id}/surveys/` (`docs/PANEL.md` §6):
 * encuestas de la entidad (periódicas creadas desde el panel y
 * post-actividad automáticas). Visible para cualquier rol con
 * `ver_panel`; solo titular/moderador pueden crear una nueva (ver
 * `useCreateSurvey.ts`).
 *
 * **Pagina de verdad** (`{count, next, previous, results}`), aunque el
 * esquema y este mismo docstring la daban por «array plano sin paginar».
 * Con la forma real, `surveys.data.map` reventaba la página entera de
 * Encuestas con un `TypeError` — misma clase que el fallo de
 * `reports/queue` que documenta CLAUDE.md, y por el mismo motivo: el test
 * mockeaba un array, así que la forma nunca se ejercitó. Encontrado
 * recorriendo el panel de verdad (auditoría de producto, 2026-09-23).
 *
 * Se recorren todas las páginas porque las `post_event` las crea el
 * backend sola por cada actividad completada: son muchas con el tiempo y
 * la pantalla no tiene paginación propia. Con el tope agotado se avisa,
 * nunca se devuelve un listado truncado que parezca completo (mismo
 * criterio que `useEntityCommunities`).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { PANEL } from "@/lib/api/endpoints";
import type { PaginatedSurveyList, Survey } from "@/lib/api/types";

export type SurveysErrorKind = "sin_acceso" | "demasiadas_paginas" | "desconocido";

export class SurveysError extends Error {
  readonly kind: SurveysErrorKind;

  constructor(kind: SurveysErrorKind, message: string) {
    super(message);
    this.name = "SurveysError";
    this.kind = kind;
  }
}

/** Tope de páginas: 50 × 20 por página = 1000 encuestas. */
const MAX_PAGES = 50;

async function fetchAllPages(orgId: number | string): Promise<Survey[]> {
  const filas: Survey[] = [];
  let page = 1;
  let next: string | null = PANEL.SURVEYS(orgId);

  while (next && page <= MAX_PAGES) {
    const data: PaginatedSurveyList = await apiFetch<PaginatedSurveyList>(
      `${PANEL.SURVEYS(orgId)}?page=${page}`,
    );
    filas.push(...data.results);
    next = data.next;
    page += 1;
  }

  if (next) {
    throw new SurveysError(
      "demasiadas_paginas",
      "Hay demasiadas encuestas para cargarlas todas; contacta con Popyplan.",
    );
  }

  return filas;
}

export function useSurveys(orgId: number | string): UseQueryResult<Survey[], SurveysError> {
  return useQuery<Survey[], SurveysError>({
    queryKey: ["panel-surveys", orgId],
    queryFn: async () => {
      try {
        return await fetchAllPages(orgId);
      } catch (error) {
        if (error instanceof SurveysError) throw error;
        if (error instanceof ApiError && error.status === 403) {
          throw new SurveysError("sin_acceso", "No tienes acceso a las encuestas de esta entidad.");
        }
        throw new SurveysError("desconocido", "No se pudieron cargar las encuestas.");
      }
    },
  });
}
