/**
 * "Refresco" de sesión: como el backend no expone un refresh token (ver
 * `lib/auth/cookie.ts`), esta ruta valida que el access token guardado en
 * la cookie sigue siendo aceptado por el backend (`GET
 * /api/users/users/me/` + `GET /api/safety/platform-roles/me/`) y lo
 * devuelve tal cual junto con los datos frescos. Si el backend rechaza el
 * token (401/403: caducó o se revocó), limpia la cookie y responde 401 —
 * quien llama (`lib/api/client.ts`) interpreta eso como logout.
 */
import { NextRequest, NextResponse } from "next/server";

import { SAFETY, USERS } from "@/lib/api/endpoints";
import { serverFetch } from "@/lib/api/serverFetch";
import type { MeForArea, PlatformRoleMe } from "@/lib/api/types";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/cookie";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ detail: "Sin sesión." }, { status: 401 });
  }

  const [meResult, roleResult] = await Promise.all([
    serverFetch<MeForArea>(USERS.ME, token),
    serverFetch<PlatformRoleMe>(SAFETY.PLATFORM_ROLE_ME, token),
  ]);

  if (!meResult.ok || !roleResult.ok) {
    const response = NextResponse.json({ detail: "Sesión caducada." }, { status: 401 });
    response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  }

  return NextResponse.json({
    accessToken: token,
    user: meResult.data,
    platformRole: roleResult.data,
  });
}
