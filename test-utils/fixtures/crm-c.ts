/**
 * Enrutador de `apiFetch` para los tests de las pantallas de análisis del
 * CRM (dashboard, informes, mapa y «Necesitan atención»): responde por
 * ruta con datos realistas y `[]` a lo que no se haya pedido a propósito.
 */
import type { CrmAttention, CrmAttentionRow } from "@/lib/api/crmTypes";

import {
  CRM_STAGES,
  CRM_USER,
  CRM_USER_2,
  buildCrmAccount,
  buildCrmCoverageRow,
  buildCrmDashboard,
  buildCrmMapPoint,
  buildCrmReport,
  buildCrmTask,
} from "./crm";

export function buildCrmAttentionRow(overrides: Partial<CrmAttentionRow> = {}): CrmAttentionRow {
  return {
    ...buildCrmAccount({ days_without_contact: 35 }),
    attention_level: 30,
    next_task: buildCrmTask(),
    ...overrides,
  };
}

export function buildCrmAttention(overrides: Partial<CrmAttention> = {}): CrmAttention {
  const results = [
    buildCrmAttentionRow(),
    buildCrmAttentionRow({
      id: 2,
      name: "Ayuntamiento de Irun",
      days_without_contact: 9,
      attention_level: 7,
      next_task: null,
      owner: CRM_USER_2,
    }),
    buildCrmAttentionRow({
      id: 3,
      name: "Diputación de Álava",
      days_without_contact: 75,
      attention_level: 60,
      last_activity_at: null,
    }),
  ];
  return { count: results.length, next: null, previous: null, results, thresholds: [7, 15, 30, 60], ...overrides };
}

export const COVERAGE_BY_LEVEL = {
  province: [
    buildCrmCoverageRow(),
    buildCrmCoverageRow({ name: "Bizkaia", registered: 12, contacted: 6, negotiating: 1, clients: 1, coverage: 50 }),
  ],
  region: [buildCrmCoverageRow({ name: "País Vasco", registered: 100, contacted: 40, negotiating: 8, clients: 5, coverage: 40 })],
};

export interface CrmRoutes {
  dashboard?: unknown;
  report?: unknown;
  map?: unknown;
  attention?: unknown;
  coverage?: Partial<typeof COVERAGE_BY_LEVEL>;
}

/** `apiFetch` mock: `mockImplementation(crmApiRouter({...}))`. */
export function crmApiRouter(routes: CrmRoutes = {}) {
  return async (path: string): Promise<unknown> => {
    if (path.startsWith("/api/crm/dashboard/")) return routes.dashboard ?? buildCrmDashboard();
    if (path.startsWith("/api/crm/reports/")) return routes.report ?? buildCrmReport();
    if (path.startsWith("/api/crm/map/")) return routes.map ?? [buildCrmMapPoint()];
    if (path.startsWith("/api/crm/attention/")) return routes.attention ?? buildCrmAttention();
    if (path.startsWith("/api/crm/coverage/")) {
      const level = new URL(path, "http://x").searchParams.get("level") === "region" ? "region" : "province";
      return routes.coverage?.[level] ?? COVERAGE_BY_LEVEL[level];
    }
    if (path.startsWith("/api/crm/users/")) return [CRM_USER, CRM_USER_2];
    if (path.startsWith("/api/crm/stages/")) return CRM_STAGES;
    if (path.startsWith("/api/crm/catalog/")) return [{ id: 3, kind: "product", name: "Popyplan Asociaciones", order: 0, is_active: true }];
    if (path.startsWith("/api/crm/me/")) return { role: "sales", is_manager: false, unread_notifications: 0 };
    return [];
  };
}

/** Rutas pedidas a `apiFetch`, en orden, para comprobar la URL exacta. */
export function requestedPaths(mock: { mock: { calls: unknown[][] } }): string[] {
  return mock.mock.calls.map((call) => String(call[0]));
}
