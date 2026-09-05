/**
 * Sesión leída en el servidor (Server Components): access token → `me` +
 * rol de plataforma, en paralelo.
 *
 * Tarea W3: el access token ya no sale de la cookie (que ahora guarda un
 * refresh token, ver `lib/auth/cookie.ts`) sino de la cabecera que pone
 * `middleware.ts` en cada petición a una ruta protegida
 * (`ACCESS_TOKEN_HEADER`, tras refrescar contra el backend). Sin esa
 * cabecera (sin cookie, refresh caducado, o una ruta fuera del
 * `matcher` del middleware) no hay sesión: el layout/página que llama
 * redirige a `/login`.
 */
import { headers } from "next/headers";

import { serverFetch } from "@/lib/api/serverFetch";
import { SAFETY, USERS } from "@/lib/api/endpoints";
import type { MeForArea, PlatformRoleMe } from "@/lib/api/types";
import { ACCESS_TOKEN_HEADER } from "@/lib/auth/cookie";

export interface ServerSession {
  token: string;
  me: MeForArea;
  platformRole: PlatformRoleMe;
}

export async function getServerSession(): Promise<ServerSession | null> {
  const store = await headers();
  const token = store.get(ACCESS_TOKEN_HEADER);
  if (!token) return null;

  const [meResult, roleResult] = await Promise.all([
    serverFetch<MeForArea>(USERS.ME, token),
    serverFetch<PlatformRoleMe>(SAFETY.PLATFORM_ROLE_ME, token),
  ]);

  if (!meResult.ok || !roleResult.ok) return null;

  return { token, me: meResult.data, platformRole: roleResult.data };
}
