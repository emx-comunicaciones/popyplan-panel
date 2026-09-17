/**
 * Lectura defensiva de la respuesta de `POST /api/auth/token/refresh/`
 * (`docs/PANEL.md` §0), compartida por `middleware.ts` y
 * `app/api/session/refresh/route.ts` (hallazgo B3).
 *
 * El contrato promete `{access, refresh}`, pero un proxy, un backend a
 * medio desplegar o una página de error con estado 200 pueden devolver
 * otra cosa. Sin esta comprobación, el `as TokenRefreshResponse` dejaba
 * pasar un cuerpo vacío y la cookie de sesión acababa valiendo la cadena
 * `"undefined"` (y la cabecera interna de acceso, igual): la sesión moría
 * en silencio, sin ningún error visible.
 */
export function parseRefreshedTokens(data: unknown): { access: string; refresh: string } | null {
  const body = data as { access?: unknown; refresh?: unknown } | null;
  if (typeof body?.access !== "string" || typeof body?.refresh !== "string") return null;
  return { access: body.access, refresh: body.refresh };
}
