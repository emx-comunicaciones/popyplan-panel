/**
 * Proxy de login: recibe usuario/contraseña, llama a
 * `POST /api/auth/login/` del backend, y si sale bien completa la sesión
 * con `GET /api/users/users/me/` y `GET /api/safety/platform-roles/me/`
 * (el `user` que devuelve el login no trae `org_memberships`, así que sin
 * esta segunda llamada el panel no podría decidir el área).
 *
 * Tarea W3: el login ahora devuelve `refresh` (`docs/PANEL.md` §0) — la
 * cookie httpOnly guarda ese refresh token (nunca el access, que solo
 * viaja en la respuesta para que `hooks/useAuth.ts` lo ponga en memoria).
 * Ver `lib/auth/cookie.ts` y `middleware.ts` para el resto del diseño de
 * sesión.
 *
 * Las dos llamadas al backend (login y logout) reenvían la IP real del
 * cliente (`lib/auth/clientIp.ts`, hallazgo A1): el backend limita por IP
 * con una clave común a todo `/api/auth/*` (`ip:<ip>:auth`), así que sin
 * ella el cupo de 5 logins por minuto lo consume el propio servidor de
 * Next con sus refrescos de sesión, para todo el mundo a la vez.
 */
import { NextRequest, NextResponse } from "next/server";

import { AUTH, SAFETY, USERS } from "@/lib/api/endpoints";
import { serverFetch } from "@/lib/api/serverFetch";
import type { MeForArea, PlatformRoleMe } from "@/lib/api/types";
import { forwardedForHeaders } from "@/lib/auth/clientIp";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/cookie";

const DEFAULT_API_URL = "http://localhost:8001";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

interface LoginBody {
  username_or_email?: unknown;
  password?: unknown;
}

/**
 * El contrato promete `{key, refresh, user}` (`docs/PANEL.md` §0), pero un
 * proxy o un backend a medio desplegar puede devolver 200 con otra cosa:
 * sin esta comprobación, `refresh` acababa en la cookie como `undefined`
 * y la sesión moría en la primera navegación (hallazgo B3).
 */
function loginTokens(data: unknown): { accessToken: string; refresh: string } | null {
  const body = data as { key?: unknown; refresh?: unknown } | null;
  if (typeof body?.key !== "string" || typeof body?.refresh !== "string") return null;
  return { accessToken: body.key, refresh: body.refresh };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;

  if (typeof body?.username_or_email !== "string" || typeof body?.password !== "string") {
    return NextResponse.json(
      { detail: "Usuario y contraseña son obligatorios." },
      { status: 400 },
    );
  }

  const loginResponse = await fetch(`${apiUrl()}${AUTH.LOGIN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...forwardedForHeaders(request) },
    body: JSON.stringify({
      username_or_email: body.username_or_email,
      password: body.password,
    }),
  });

  const loginData = await loginResponse.json().catch(() => null);

  if (!loginResponse.ok) {
    return NextResponse.json(
      loginData ?? { detail: "No se pudo iniciar sesión." },
      { status: loginResponse.status },
    );
  }

  const tokens = loginTokens(loginData);
  if (!tokens) {
    return NextResponse.json(
      { detail: "Respuesta inesperada del servidor de autenticación." },
      { status: 502 },
    );
  }
  const { accessToken, refresh } = tokens;

  const [meResult, roleResult] = await Promise.all([
    serverFetch<MeForArea>(USERS.ME, accessToken),
    serverFetch<PlatformRoleMe>(SAFETY.PLATFORM_ROLE_ME, accessToken),
  ]);

  if (!meResult.ok || !roleResult.ok) {
    return NextResponse.json(
      { detail: "No se pudo recuperar el perfil tras iniciar sesión." },
      { status: 502 },
    );
  }

  const response = NextResponse.json({
    accessToken,
    user: meResult.data,
    platformRole: roleResult.data,
  });
  response.cookies.set(SESSION_COOKIE_NAME, refresh, sessionCookieOptions());
  return response;
}

export async function DELETE(request: NextRequest) {
  const refresh = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (refresh) {
    // Best-effort: invalida el refresh token en el backend
    // (`docs/PANEL.md` §0). Si falla (ya caducado, red caída…), se borra
    // la cookie igualmente: el logout local no depende de esta llamada.
    await fetch(`${apiUrl()}${AUTH.LOGOUT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...forwardedForHeaders(request) },
      body: JSON.stringify({ refresh }),
    }).catch(() => undefined);
  }

  const response = NextResponse.json({});
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
