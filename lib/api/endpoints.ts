/**
 * Endpoints del backend consumidos por el panel, centralizados como en
 * `popyplan-mobile/app/_constants/urls.ts`. `lib/api/__tests__/consumption.test.ts`
 * exige que todo endpoint aquí declarado se use en el código y tenga test
 * (o conste en `consumption-allowlist.json`, que solo puede encoger).
 *
 * W1 solo consume login, sesión propia y rol de plataforma, más la ficha
 * de una entidad (cabecera del panel). Las rutas de métricas de
 * `docs/PANEL.md` (`/api/panel/{entidad,paraguas,plataforma}/*\/metrics/`)
 * las consume la tarea W2: no se declaran aquí todavía para no dejar
 * endpoints "muertos" sin uso real.
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
