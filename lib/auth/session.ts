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
 *
 * Tolerancia al endpoint de rol: si `/me/` va bien pero
 * `platform-roles/me/` falla con 5xx o error de red (caída transitoria),
 * la sesión se resuelve igual con `platformRole = { role: null }` en vez
 * de anularse entera: el endpoint de roles no es imprescindible para las
 * páginas de entidad (casi todas solo miran el rol de `OrgMembership`), y
 * mandar a `/login` por un 502 puntual destruiría una sesión sana. Un
 * 401/403 del endpoint de roles sí anula la sesión, igual que un fallo de
 * `/me/`: ahí el token es el problema, no el endpoint.
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
    serverFetch<PlatformRoleMe>(SAFETY.PLATFORM_ROLE_ME, token).catch(
      // Error de red: tratarlo como fallo 5xx (sesión tolerante, ver
      // docstring del módulo) en vez de reventar el render completo.
      () => null,
    ),
  ]);

  if (!meResult.ok) return null;

  let platformRole: PlatformRoleMe;
  if (roleResult && roleResult.ok) {
    platformRole = roleResult.data;
  } else if (roleResult && (roleResult.status === 401 || roleResult.status === 403)) {
    return null;
  } else {
    platformRole = { role: null };
  }

  return { token, me: meResult.data, platformRole };
}
