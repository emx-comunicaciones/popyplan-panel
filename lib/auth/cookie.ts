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

/** Vida del refresh del panel (`REFRESH_LIFETIME_PANEL_DAYS` = 30 en el backend); cada rotación la cuenta de nuevo. */
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

/**
 * Token de acceso en una cookie `httpOnly` (2026-09-30). El middleware y
 * `/api/session/refresh` lo reutilizan mientras le quede vida, en vez de
 * rotar el refresh en cada petición: con `ROTATE_REFRESH_TOKENS` +
 * `BLACKLIST_AFTER_ROTATION`, los prefetch del menú salían a la vez con el
 * mismo refresh, uno lo rotaba y el resto recibía 401 (en Vercel, además,
 * cada instancia del middleware tiene su propia memoria). Resultado: al
 * pulsar el menú el panel echaba al login. Mismas opciones que la cookie de
 * sesión; caduca con el propio token.
 */
export const ACCESS_COOKIE_NAME = "pp_access";

/** Margen: un token al que le quede menos que esto se renueva ya. */
export const ACCESS_TOKEN_MIN_SECONDS_LEFT = 120;

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

/** Segundos de vida que le quedan a un JWT (`exp`), o 0 si no se puede leer. */
export function accessTokenSecondsLeft(token: string | undefined, nowMs: number = Date.now()): number {
  if (!token) return 0;
  const parts = token.split(".");
  if (parts.length !== 3) return 0;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: unknown };
    if (typeof payload.exp !== "number") return 0;
    return Math.max(0, Math.floor(payload.exp - nowMs / 1000));
  } catch {
    return 0;
  }
}

/** El token de la cookie, si todavía vale para una petición (con margen). */
export function usableAccessToken(token: string | undefined, nowMs: number = Date.now()): string | null {
  return token && accessTokenSecondsLeft(token, nowMs) > ACCESS_TOKEN_MIN_SECONDS_LEFT ? token : null;
}

/** Opciones de la cookie del token de acceso: caduca a la vez que él. */
export function accessCookieOptions(token: string, nowMs: number = Date.now()): SessionCookieOptions {
  return sessionCookieOptions(Math.max(0, accessTokenSecondsLeft(token, nowMs) - ACCESS_TOKEN_MIN_SECONDS_LEFT));
}
