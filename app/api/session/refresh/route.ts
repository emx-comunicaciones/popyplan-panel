/**
 * Refresco real de sesión (tarea W3): la cookie httpOnly guarda un
 * refresh token de verdad (`lib/auth/cookie.ts`). Esta ruta lo cambia por
 * un access token nuevo llamando a `POST /api/auth/token/refresh/`
 * (`docs/PANEL.md` §0); como `ROTATE_REFRESH_TOKENS=True`, la respuesta
 * trae también un refresh nuevo que sustituye al guardado (el anterior
 * queda en lista negra: reutilizarlo daría 401). Si el backend rechaza el
 * refresh (caducado, en lista negra, formato inválido), limpia la cookie
 * y responde 401 — quien llama (`lib/api/client.ts`, `hooks/useAuth.ts`)
 * lo interpreta como logout.
 *
 * Tras renovar el access token, completa la sesión igual que el login
 * (`GET /me/` + `GET /platform-roles/me/`) para que quien restaura sesión
 * al recargar la página tenga datos frescos, no solo el token.
 */
import { NextRequest, NextResponse } from "next/server";

import { AUTH, SAFETY, USERS } from "@/lib/api/endpoints";
import { serverFetch } from "@/lib/api/serverFetch";
import type { MeForArea, PlatformRoleMe, TokenRefreshResponse } from "@/lib/api/types";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/cookie";

const DEFAULT_API_URL = "http://localhost:8001";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

function cleared(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function POST(request: NextRequest) {
  const refresh = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!refresh) {
    return NextResponse.json({ detail: "Sin sesión." }, { status: 401 });
  }

  const refreshResponse = await fetch(`${apiUrl()}${AUTH.TOKEN_REFRESH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!refreshResponse.ok) {
    return cleared({ detail: "Sesión caducada." }, 401);
  }

  const { access, refresh: newRefresh } = (await refreshResponse.json()) as TokenRefreshResponse;

  const [meResult, roleResult] = await Promise.all([
    serverFetch<MeForArea>(USERS.ME, access),
    serverFetch<PlatformRoleMe>(SAFETY.PLATFORM_ROLE_ME, access),
  ]);

  if (!meResult.ok || !roleResult.ok) {
    return cleared({ detail: "Sesión caducada." }, 401);
  }

  const response = NextResponse.json({
    accessToken: access,
    user: meResult.data,
    platformRole: roleResult.data,
  });
  response.cookies.set(SESSION_COOKIE_NAME, newRefresh, sessionCookieOptions());
  return response;
}
