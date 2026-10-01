/**
 * Marca de cliente que el servidor de Next manda al backend en el login y
 * en el refresco (`middleware.ts`, `app/api/session/route.ts`,
 * `app/api/session/refresh/route.ts`): `X-Popyplan-Client: panel`.
 *
 * Con ella el backend emite un refresh de **30 días** (el de la app móvil
 * dura 90). La sesión es deslizante: cada rotación devuelve un refresh
 * nuevo con el mismo cliente y el plazo contado desde ahora, y
 * `sessionCookieOptions()` renueva la cookie `pp_session` con esos mismos
 * 30 días (`SESSION_COOKIE_MAX_AGE_SECONDS`) en cada `Set-Cookie` de
 * rotación.
 *
 * Solo se manda desde el servidor: el navegador no puede ponerla (el
 * backend no la admite en CORS) y aquí nunca se copia de la petición
 * entrante. En el refresco el backend la ignora si el refresh ya lleva
 * marca; solo la usa con refresh anteriores sin ella.
 */
export const PANEL_CLIENT_HEADER = "X-Popyplan-Client";

export function panelClientHeaders(): { "X-Popyplan-Client": "panel" } {
  return { [PANEL_CLIENT_HEADER]: "panel" } as { "X-Popyplan-Client": "panel" };
}
