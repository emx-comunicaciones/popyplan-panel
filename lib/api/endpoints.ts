/**
 * Endpoints del backend consumidos por el panel, centralizados como en
 * `popyplan-mobile/app/_constants/urls.ts`. `lib/api/__tests__/consumption.test.ts`
 * exige que todo endpoint aquí declarado se use en el código y tenga test
 * (o conste en `consumption-allowlist.json`, que solo puede encoger).
 *
 * W1 consumía solo login, sesión propia, rol de plataforma y la ficha de
 * una entidad. W2 añade las rutas de métricas y exportación de
 * `docs/PANEL.md` §1 (métricas) y §2 (exportación, con las rutas de
 * respaldo indicadas en el brief de la tarea mientras esa sección no
 * exista todavía — ver `docs/preguntas-diseno.md`).
 */

export const AUTH = {
  /** `POST /api/auth/login/` (`users/auth_viewsets.py::AuthViewSet.login`). */
  LOGIN: "/api/auth/login/",
} as const;

export const USERS = {
  /** `GET /api/users/users/me/`. */
  ME: "/api/users/users/me/",
} as const;

export const SAFETY = {
  /** `GET /api/safety/platform-roles/me/`. */
  PLATFORM_ROLE_ME: "/api/safety/platform-roles/me/",
} as const;

export const ORGANIZATIONS = {
  /** `GET`/`PATCH /api/organizations/{id}/`. */
  DETAIL: (id: number | string) => `/api/organizations/${id}/`,
} as const;

/**
 * `docs/PANEL.md` §1. `?since&until&group_by` los añade quien llama
 * (`hooks/useMetrics.ts`), nunca aquí: estas funciones solo devuelven la
 * ruta base.
 */
export const METRICS = {
  /** `GET /api/panel/entidad/{org_id}/metrics/`. */
  ENTIDAD: (orgId: number | string) => `/api/panel/entidad/${orgId}/metrics/`,
  /** `GET /api/panel/paraguas/{org_id}/metrics/`. */
  PARAGUAS: (orgId: number | string) => `/api/panel/paraguas/${orgId}/metrics/`,
  /** `GET /api/panel/plataforma/metrics/`. */
  PLATAFORMA: () => `/api/panel/plataforma/metrics/`,
} as const;

/**
 * Exportación de informes (CSV/PDF). `docs/PANEL.md` aún no tiene una
 * §2 «Exportación» (P3 la añade en paralelo a esta tarea): rutas de
 * respaldo del brief de la tarea W2, a confirmar/ajustar contra esa
 * sección antes de cerrar (ver `docs/preguntas-diseno.md`).
 */
export const EXPORT = {
  /** `GET /api/panel/entidad/{org_id}/export/?format=csv|pdf&since&until&group_by`. */
  ENTIDAD: (orgId: number | string) => `/api/panel/entidad/${orgId}/export/`,
  /** `GET /api/panel/paraguas/{org_id}/export/?format=csv|pdf&since&until&group_by`. */
  PARAGUAS: (orgId: number | string) => `/api/panel/paraguas/${orgId}/export/`,
  /** `GET /api/panel/plataforma/export/?format=csv|pdf&since&until&group_by`. */
  PLATAFORMA: () => `/api/panel/plataforma/export/`,
} as const;
