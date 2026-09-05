/**
 * Sesión leída en el servidor (Server Components): cookie → `me` + rol de
 * plataforma, en paralelo. Ninguna de las dos llamadas reintenta: si el
 * access token de la cookie ya no vale, el layout/página que llama a esto
 * redirige a `/login` (la cookie queda tal cual; `DELETE /api/session`
 * la limpia solo en un logout explícito).
 */
import { cookies } from "next/headers";

import { serverFetch } from "@/lib/api/serverFetch";
import { SAFETY, USERS } from "@/lib/api/endpoints";
import type { MeForArea, PlatformRoleMe } from "@/lib/api/types";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie";

export interface ServerSession {
  token: string;
  me: MeForArea;
  platformRole: PlatformRoleMe;
}

export async function getServerSession(): Promise<ServerSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const [meResult, roleResult] = await Promise.all([
    serverFetch<MeForArea>(USERS.ME, token),
    serverFetch<PlatformRoleMe>(SAFETY.PLATFORM_ROLE_ME, token),
  ]);

  if (!meResult.ok || !roleResult.ok) return null;

  return { token, me: meResult.data, platformRole: roleResult.data };
}
