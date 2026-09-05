/**
 * Cookie de sesión que guarda el route handler `app/api/session/route.ts`.
 *
 * Desviación documentada respecto al diseño previsto («refresh token en
 * cookie httpOnly»): `POST /api/auth/login/` (`users/auth_viewsets.py`,
 * `AuthViewSet.login`) solo devuelve `{key, user}` — el `refresh` que crea
 * (`RefreshToken.for_user(user)`) se usa una vez para sacar
 * `refresh.access_token` y se descarta; no hay `Set-Cookie` ni cuerpo con
 * un refresh token, y `docs/schema.yaml` no tiene ninguna ruta
 * `/api/*token/refresh*`. Mientras el backend no exponga un refresh token
 * real, esta cookie guarda el propio access token (el único credential
 * que da el login) para poder restaurar la sesión tras recargar la
 * página y para que los Server Components (`lib/auth/session.ts`) lo lean
 * sin pasar por memoria de cliente. Ver `docs/preguntas-diseno.md`.
 */

export const SESSION_COOKIE_NAME = "pp_session";

/** Vida máxima del access token hoy (`SIMPLE_JWT.ACCESS_TOKEN_LIFETIME`, `pop/settings.py`). */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

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
