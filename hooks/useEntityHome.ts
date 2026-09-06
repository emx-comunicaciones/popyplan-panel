"use client";

/**
 * Compone el Inicio de la entidad: actividades de hoy (`docs/PANEL.md`
 * §3.4), avisos de ayuda pendientes y reportes pendientes
 * (`docs/SEGURIDAD_Y_MODERACION.md` §4-§5, solo el `count` de cada cola)
 * y las métricas del mes (`docs/PANEL.md` §1, mismo `useMetrics` de la
 * vista del financiador — W2).
 *
 * Los dos contadores de guardia solo los ven quien modera la entidad
 * (`titular`/`moderador`) o, para ayuda, la guardia asignada — el resto
 * de roles con acceso a Inicio (`analista`, `dinamizador`, `referente`)
 * reciben 403. Este hook no lo trata como un error de página: un 403 en
 * cualquiera de los dos contadores se traduce a `count: null` («esta
 * tarjeta no es para tu rol»), para que la página la oculte en vez de
 * pintar un `ErrorState` que no aporta nada. Cualquier otro fallo sí
 * queda como error de verdad (`isError`).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { SAFETY } from "@/lib/api/endpoints";
import type { EntityEventRow, MetricsResponse, Program } from "@/lib/api/types";
import { toIso, presetPeriod } from "@/lib/metrics/period";

import { useEntityEvents, type EntityEventsError } from "./useEntityEvents";
import { useMetrics, type MetricsError } from "./useMetrics";
import { usePrograms, type ProgramsError } from "./usePrograms";

/**
 * Carry-over de la tarea W6 (hallazgo del e2e contra el backend real):
 * `reports/queue` y `help-requests/pending` responden un **array
 * plano**, nunca `{count, ...}` (`lib/api/types.ts`, docstring encima de
 * `ReportRow`/`HelpRequestRow`) — antes de esta tarea se leía
 * `data.count` de un array, siempre `undefined`, así que estas dos
 * tarjetas del Inicio nunca mostraron un recuento real. Se cuenta
 * `.length` del array.
 */
async function fetchOptionalCount(path: string): Promise<number | null> {
  try {
    const data = await apiFetch<unknown[]>(path);
    return data.length;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return null;
    }
    throw error;
  }
}

export interface EntityHomeResult {
  today: UseQueryResult<EntityEventRow[], EntityEventsError>;
  pendingReports: UseQueryResult<number | null, Error>;
  pendingHelpRequests: UseQueryResult<number | null, Error>;
  metrics: UseQueryResult<MetricsResponse, MetricsError>;
  /**
   * Tarjeta «Programas en curso» (tarea W3, Fase 6, `docs/PANEL.md`
   * §12): reutiliza `usePrograms` (mismo `ver_panel` que el resto de
   * Inicio, sin 403 que traducir a `null` como los contadores de
   * guardia) y cuenta `status === 'active'` en el cliente — no hay un
   * endpoint de solo recuento para esto.
   */
  activePrograms: UseQueryResult<Program[], ProgramsError>;
}

export function useEntityHome(orgId: number | string): EntityHomeResult {
  const today = toIso(new Date());

  const todayEvents = useEntityEvents(orgId, { since: today, until: today });

  const pendingReports = useQuery<number | null>({
    queryKey: ["panel-home-pending-reports", orgId],
    queryFn: () => fetchOptionalCount(`${SAFETY.REPORTS_QUEUE()}?organization=${orgId}&status=pending`),
  });

  const pendingHelpRequests = useQuery<number | null>({
    queryKey: ["panel-home-pending-help-requests", orgId],
    queryFn: () => fetchOptionalCount(`${SAFETY.HELP_REQUESTS_PENDING()}?organization=${orgId}`),
  });

  const metrics = useMetrics("entidad", orgId, presetPeriod("mes"));
  const activePrograms = usePrograms(orgId);

  return { today: todayEvents, pendingReports, pendingHelpRequests, metrics, activePrograms };
}
