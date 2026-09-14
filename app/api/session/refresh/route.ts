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
 * Resiliencia (la sesión no se destruye por fallos transitorios):
 *
 * - **Error de red** al llamar al backend: 503 **sin** borrar la cookie
 *   (el `cleared()` de un 401 sí borra; aquí no — la cookie sigue válida
 *   y el cliente puede reintentar). Antes el `fetch` sin `try/catch`
 *   convertía el fallo de red en 500 → el cliente lo traducía a «Tu
 *   sesión ha caducado» y cerraba sesión.
 * - **`/me/` o `platform-roles/me/` caídos tras una rotación exitosa**:
 *   503 **guardando igualmente el refresh nuevo** en la cookie: el
 *   backend ya considera válido R2 (R1 está en lista negra), así que
 *   tirar R2 destruiría una sesión sana. La cookie se rota igualmente —
 *   quien reintente lo hará con R2. Antes se respondía 401 borrando la
 *   cookie.
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

  let refreshResponse: Response;
  try {
    refreshResponse = await fetch(`${apiUrl()}${AUTH.TOKEN_REFRESH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
  } catch {
    // Red caída: la cookie se queda tal cual (sigue válida), el cliente
    // puede reintentar el refresco.
    return NextResponse.json({ detail: "No se pudo completar el refresco." }, { status: 503 });
  }

  if (!refreshResponse.ok) {
    return cleared({ detail: "Sesión caducada." }, 401);
  }

  const { access, refresh: newRefresh } = (await refreshResponse.json()) as TokenRefreshResponse;

  const [meResult, roleResult] = await Promise.all([
    serverFetch<MeForArea>(USERS.ME, access),
    serverFetch<PlatformRoleMe>(SAFETY.PLATFORM_ROLE_ME, access),
  ]);

  if (!meResult.ok || !roleResult.ok) {
    // Rotación ya aplicada en el backend (R1 en lista negra, R2 válido):
    // responder 401 y borrar la cookie destruiría una sesión sana. 503
    // guardando R2: quien reintente lo hará con el refresh nuevo.
    const response = NextResponse.json(
      { detail: "No se pudo completar el refresco." },
      { status: 503 },
    );
    response.cookies.set(SESSION_COOKIE_NAME, newRefresh, sessionCookieOptions());
    return response;
  }

  const response = NextResponse.json({
    accessToken: access,
    user: meResult.data,
    platformRole: roleResult.data,
  });
  response.cookies.set(SESSION_COOKIE_NAME, newRefresh, sessionCookieOptions());
  return response;
}
