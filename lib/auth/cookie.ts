/**
 * Cookie de sesión que guarda el route handler `app/api/session/route.ts`.
 *
 * Tarea W3: `POST /api/auth/login/` ahora devuelve `refresh` (30 días,
 * `docs/PANEL.md` §0) y existe `POST /api/auth/token/refresh/` de verdad
 * (`rest_framework_simplejwt`, `ROTATE_REFRESH_TOKENS=True` +
 * `BLACKLIST_AFTER_ROTATION=True`: cada uso rota el refresh y deja el
 * anterior en lista negra). Esta cookie guarda **el refresh token**,
 * nunca el access token — el access vive solo en memoria de cliente
 * (`lib/auth/tokenStore.ts`) o, en el servidor, en la cabecera que pone
 * `middleware.ts` en cada petición (ver su docstring: un Server Component
 * no puede escribir cookies, así que la rotación del refresh se hace en
 * middleware, no en `lib/auth/session.ts`).
 */

export const SESSION_COOKIE_NAME = "pp_session";

/** Vida máxima del refresh token (`SIMPLE_JWT.REFRESH_TOKEN_LIFETIME` = 30 días). */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Cabecera que `middleware.ts` añade a la petición reenviada con el
 * access token recién obtenido (nunca sale hacia el navegador: es
 * comunicación interna middleware → Server Component dentro del mismo
 * proceso de Next.js). `lib/auth/session.ts::getServerSession` la lee con
 * `headers()` en vez de fiarse de la cookie, que ahora es un refresh
 * token y no sirve para llamar directamente a la API.
 */
export const ACCESS_TOKEN_HEADER = "x-pp-access-token";

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "strict";
  path: "/";
  maxAge: number;
}

/** `secure` exige HTTPS: en desarrollo local (http://localhost) se desactiva. */
export function sessionCookieOptions(
  maxAge: number = SESSION_COOKIE_MAX_AGE_SECONDS,
): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  };
}
