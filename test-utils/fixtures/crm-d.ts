/**
 * Fixtures y utilidades de las pantallas de trabajo del CRM (actividades,
 * tareas, calendario, documentos y configuración).
 */
import type { Mock } from "vitest";

import type { CrmCatalogItem, CrmSettings, CrmTag, CrmTaskCounts } from "@/lib/api/crmTypes";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import { CRM_USER, CRM_USER_2, buildCrmAccount, paginated } from "./crm";

export const CRM_USERS = [CRM_USER, CRM_USER_2];

export const CRM_TASK_COUNTS: CrmTaskCounts = { today: 3, upcoming: 5, overdue: 1, done: 12 };

export const CRM_SETTINGS: CrmSettings = {
  attention_days: [15, 30, 60],
  opportunity_idle_days: 21,
  proposal_followup_days: 10,
  close_date_warning_days: 14,
  renewal_alert_days: [90, 60, 30],
};

export function buildCrmCatalogItem(overrides: Partial<CrmCatalogItem> = {}): CrmCatalogItem {
  return { id: 1, kind: "source", name: "Jornada FEMP", order: 0, is_active: true, ...overrides } as CrmCatalogItem;
}

export function buildCrmTag(overrides: Partial<CrmTag> = {}): CrmTag {
  return { id: 1, name: "Adicciones", color: "#1fb3ae", ...overrides } as CrmTag;
}

/** Sesión de servidor de un rol de CRM. */
export function crmSession(role: "sales" | "sales_lead" | "superadmin" | "moderator") {
  return { token: "t", me: buildMe({ org_memberships: [] }), platformRole: buildPlatformRole(role) };
}

type Handler = unknown | ((path: string, init?: { method?: string; body?: unknown }) => unknown);

/**
 * Hace que `apiFetch` conteste por ruta (sin la query). Las rutas de CRM
 * comunes (`me`, `users`, `accounts` para los selectores) vienen puestas.
 */
export function routeApi(apiFetchMock: Mock, routes: Record<string, Handler>): void {
  const all: Record<string, Handler> = {
    "/api/crm/users/": CRM_USERS,
    "/api/crm/accounts/": paginated([buildCrmAccount()]),
    ...routes,
  };
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    const handler = all[path.split("?")[0]];
    if (handler === undefined) throw new Error(`Ruta sin mock: ${path}`);
    return typeof handler === "function" ? (handler as (p: string, i?: unknown) => unknown)(path, init) : handler;
  });
}

/** Llamadas a `apiFetch` cuyo path (con query) contiene `fragment`. */
export function callsTo(apiFetchMock: Mock, fragment: string, method?: string) {
  return apiFetchMock.mock.calls.filter(
    ([path, init]) => String(path).includes(fragment) && (method ? (init?.method ?? "GET") === method : true),
  );
}
