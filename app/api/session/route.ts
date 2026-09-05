/**
 * Proxy de login: recibe usuario/contraseña, llama a
 * `POST /api/auth/login/` del backend, y si sale bien completa la sesión
 * con `GET /api/users/users/me/` y `GET /api/safety/platform-roles/me/`
 * (el `user` que devuelve el login no trae `org_memberships`, así que sin
 * esta segunda llamada el panel no podría decidir el área). Guarda el
 * access token en una cookie httpOnly — ver `lib/auth/cookie.ts` para la
 * desviación sobre el refresh token, que el backend no expone hoy.
 */
import { NextRequest, NextResponse } from "next/server";

import { AUTH, SAFETY, USERS } from "@/lib/api/endpoints";
import { serverFetch } from "@/lib/api/serverFetch";
import type { LoginResponse, MeForArea, PlatformRoleMe } from "@/lib/api/types";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/cookie";

const DEFAULT_API_URL = "http://localhost:8001";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

interface LoginBody {
  username_or_email?: unknown;
  password?: unknown;
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
    headers: { "Content-Type": "application/json" },
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

  const { key: accessToken } = loginData as LoginResponse;

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
  response.cookies.set(SESSION_COOKIE_NAME, accessToken, sessionCookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({});
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
