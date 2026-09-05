/**
 * Renueva el access token para las páginas del servidor (Server
 * Components) en cada navegación protegida.
 *
 * Motivo: desde la tarea W3 la cookie httpOnly (`pp_session`,
 * `lib/auth/cookie.ts`) guarda un **refresh token** (no un access token
 * como antes), y `POST /api/auth/token/refresh/` **rota** ese refresh en
 * cada uso (`ROTATE_REFRESH_TOKENS=True`, `docs/PANEL.md` §0). Un Server
 * Component (`lib/auth/session.ts::getServerSession`, usado por los
 * layouts de `/entidad`, `/paraguas` y `/plataforma`) no puede escribir
 * cookies — si intentara refrescar él mismo, la cookie rotada se perdería
 * y la sesión moriría en la siguiente petición (el refresh anterior ya
 * quedó en lista negra). El middleware sí puede escribir cookies en la
 * respuesta, así que hace el refresco aquí, una vez por navegación:
 *
 * 1. Lee el refresh de la cookie. Sin cookie, deja pasar tal cual (la
 *    página/layout que llame a `getServerSession()` no encontrará la
 *    cabecera de acceso y redirigirá a `/login`, como siempre).
 * 2. Llama a `POST /api/auth/token/refresh/`. Si el backend lo rechaza
 *    (caducado, en lista negra), borra la cookie y deja pasar sin
 *    cabecera (mismo resultado: `getServerSession()` devuelve null).
 * 3. Si sale bien, guarda el refresh nuevo en la cookie (rotación) y
 *    añade el access token a la petición reenviada como cabecera interna
 *    (`ACCESS_TOKEN_HEADER`) — nunca llega al navegador, la lee
 *    `lib/auth/session.ts` con `headers()` de `next/headers`.
 */
import { NextRequest, NextResponse } from "next/server";

import { AUTH } from "@/lib/api/endpoints";
import type { TokenRefreshResponse } from "@/lib/api/types";
import { ACCESS_TOKEN_HEADER, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/cookie";

const DEFAULT_API_URL = "http://localhost:8001";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

export async function middleware(request: NextRequest) {
  const refresh = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!refresh) {
    return NextResponse.next();
  }

  let refreshResponse: Response;
  try {
    refreshResponse = await fetch(`${apiUrl()}${AUTH.TOKEN_REFRESH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
  } catch {
    return NextResponse.next();
  }

  if (!refreshResponse.ok) {
    const response = NextResponse.next();
    response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  }

  const { access, refresh: newRefresh } = (await refreshResponse.json()) as TokenRefreshResponse;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ACCESS_TOKEN_HEADER, access);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(SESSION_COOKIE_NAME, newRefresh, sessionCookieOptions());
  return response;
}

export const config = {
  matcher: ["/entidad/:path*", "/paraguas/:path*", "/plataforma/:path*", "/elegir-entidad"],
};
