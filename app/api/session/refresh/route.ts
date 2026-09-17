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
 * La llamada al backend lleva la IP real del cliente
 * (`lib/auth/clientIp.ts`, hallazgo A1): el límite por IP del backend es
 * común a login y refresco (`ip:<ip>:auth`), así que sin ella los
 * refrescos del servidor de Next agotan el cupo de login de todo el mundo.
 *
 * Resiliencia (la sesión no se destruye por fallos transitorios):
 *
 * - **Refrescos concurrentes con la misma cookie** (hallazgo M1):
 *   `singleFlight` (`lib/auth/singleFlight.ts`, igual que `middleware.ts`)
 *   los agrupa en una sola rotación — sin esto, el StrictMode de `next
 *   dev` (que ejecuta dos veces el inicializador de `app/providers.tsx`) o
 *   dos pestañas a la vez rotaban el refresh dos veces y la segunda
 *   recibía 401 → «Tu sesión ha caducado» justo tras entrar.
 * - **Rotación reciente** (`recentlyRotated`, 10 s): si el backend
 *   responde 401 a un refresh que este mismo proceso acaba de rotar con
 *   éxito, la respuesta guardada se repite en vez de borrar la cookie. Es
 *   el caso de una petición que salió del navegador **antes** de que se
 *   aplicara el `Set-Cookie` de la rotación anterior: lleva la cookie
 *   vieja, que el backend ya tiene en lista negra, pero la sesión está
 *   sana. La ventana es corta a propósito (el valor guardado incluye un
 *   access token) y la limpieza es perezosa, al consultar.
 * - **Error de red** al llamar al backend: 503 **sin** borrar la cookie
 *   (el `cleared()` de un 401 sí borra; aquí no — la cookie sigue válida
 *   y el cliente puede reintentar). Antes el `fetch` sin `try/catch`
 *   convertía el fallo de red en 500 → el cliente lo traducía a «Tu
 *   sesión ha caducado» y cerraba sesión. Una respuesta ilegible (no es
 *   JSON, o sin `access`/`refresh`) recibe el mismo trato (hallazgo B3):
 *   antes reventaba con un 500 y el cliente cerraba sesión igual.
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
import type { MeForArea, PlatformRoleMe } from "@/lib/api/types";
import { forwardedForHeaders } from "@/lib/auth/clientIp";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/cookie";
import { singleFlight } from "@/lib/auth/singleFlight";

const DEFAULT_API_URL = "http://localhost:8001";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

/** Resultado de una rotación, independiente de la respuesta HTTP que genera. */
type RotatedResult =
  | { kind: "ok"; refresh: string; access: string; user: MeForArea; platformRole: PlatformRoleMe }
  | { kind: "rotated-sin-perfil"; refresh: string };

type RefreshResult = RotatedResult | { kind: "caducado" } | { kind: "no-disponible" };

/** Rotaciones en vuelo indexadas por el refresh que las provocó (single-flight). */
const inFlightByRefresh = new Map<string, Promise<RefreshResult>>();

/** Ventana en la que se repite el resultado de una rotación ya aplicada. */
const RECENT_ROTATION_TTL_MS = 10_000;

const recentlyRotated = new Map<string, { result: RotatedResult; expiresAt: number }>();

function rememberRotation(refresh: string, result: RotatedResult): void {
  recentlyRotated.set(refresh, { result, expiresAt: Date.now() + RECENT_ROTATION_TTL_MS });
}

/** Limpieza perezosa: se purga lo caducado en cada consulta. */
function recallRotation(refresh: string): RotatedResult | null {
  const now = Date.now();
  for (const [key, entry] of recentlyRotated) {
    if (entry.expiresAt <= now) recentlyRotated.delete(key);
  }
  return recentlyRotated.get(refresh)?.result ?? null;
}

function rotatedTokens(data: unknown): { access: string; refresh: string } | null {
  const body = data as { access?: unknown; refresh?: unknown } | null;
  if (typeof body?.access !== "string" || typeof body?.refresh !== "string") return null;
  return { access: body.access, refresh: body.refresh };
}

async function rotate(refresh: string, request: NextRequest): Promise<RefreshResult> {
  let refreshResponse: Response;
  try {
    refreshResponse = await fetch(`${apiUrl()}${AUTH.TOKEN_REFRESH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...forwardedForHeaders(request) },
      body: JSON.stringify({ refresh }),
    });
  } catch {
    return { kind: "no-disponible" };
  }

  if (!refreshResponse.ok) return { kind: "caducado" };

  const tokens = rotatedTokens(await refreshResponse.json().catch(() => null));
  if (!tokens) return { kind: "no-disponible" };

  // La rotación ya está aplicada en el backend: pase lo que pase con el
  // perfil (5xx, red caída), hay que quedarse con el refresh nuevo o la
  // sesión muere sin culpa de quien navega.
  const [meResult, roleResult] = await Promise.all([
    serverFetch<MeForArea>(USERS.ME, tokens.access).catch(() => null),
    serverFetch<PlatformRoleMe>(SAFETY.PLATFORM_ROLE_ME, tokens.access).catch(() => null),
  ]);

  const result: RotatedResult =
    meResult?.ok && roleResult?.ok
      ? {
          kind: "ok",
          refresh: tokens.refresh,
          access: tokens.access,
          user: meResult.data,
          platformRole: roleResult.data,
        }
      : { kind: "rotated-sin-perfil", refresh: tokens.refresh };

  rememberRotation(refresh, result);
  return result;
}

function withRotatedCookie(response: NextResponse, refresh: string): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, refresh, sessionCookieOptions());
  return response;
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

  let result = await singleFlight(inFlightByRefresh, refresh, () => rotate(refresh, request));

  if (result.kind === "caducado") {
    // El backend lo rechaza porque este mismo proceso lo rotó hace un
    // instante: la sesión está viva, se repite aquel resultado.
    result = recallRotation(refresh) ?? result;
  }

  if (result.kind === "caducado") {
    return cleared({ detail: "Sesión caducada." }, 401);
  }

  if (result.kind === "no-disponible") {
    // Red caída o respuesta ilegible: la cookie se queda tal cual (sigue
    // válida), el cliente puede reintentar el refresco.
    return NextResponse.json({ detail: "No se pudo completar el refresco." }, { status: 503 });
  }

  if (result.kind === "rotated-sin-perfil") {
    // Rotación ya aplicada en el backend (R1 en lista negra, R2 válido):
    // responder 401 y borrar la cookie destruiría una sesión sana. 503
    // guardando R2: quien reintente lo hará con el refresh nuevo.
    return withRotatedCookie(
      NextResponse.json({ detail: "No se pudo completar el refresco." }, { status: 503 }),
      result.refresh,
    );
  }

  return withRotatedCookie(
    NextResponse.json({
      accessToken: result.access,
      user: result.user,
      platformRole: result.platformRole,
    }),
    result.refresh,
  );
}
