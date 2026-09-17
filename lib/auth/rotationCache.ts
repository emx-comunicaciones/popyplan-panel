/**
 * Memoria corta de rotaciones de refresh token, para
 * `app/api/session/refresh/route.ts` (hallazgo M1).
 *
 * `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION` (`docs/PANEL.md`
 * §0) hacen que un refresh solo sirva una vez. Una petición que salió del
 * navegador **antes** de aplicarse el `Set-Cookie` de la rotación
 * anterior lleva el refresh viejo: el backend responde 401 aunque la
 * sesión esté sana. Guardando el resultado de la rotación un instante, esa
 * segunda petición recibe la misma respuesta en vez de un cierre de
 * sesión.
 *
 * La ventana es deliberadamente corta: el valor guardado incluye un access
 * token vivo y el perfil completo. Solo tiene que cubrir la carrera de
 * arranque entre el middleware y `restoreSession`/los prefetch, que se
 * resuelve en mucho menos de un segundo. Además:
 *
 * - se purga lo caducado **al guardar y al consultar**, así el mapa no
 *   crece sin límite en un proceso de larga vida (ni retiene tokens más
 *   allá del TTL aunque nadie vuelva a consultarlo);
 * - `clearRecentRotations()` lo vacía entero en el logout
 *   (`app/api/session/route.ts::DELETE`): si no, durante la ventana se
 *   podía cambiar el refresh anterior por un access token vivo después de
 *   cerrar sesión. Vaciar el mapa entero (y no solo la cadena de quien
 *   sale) puede dejar sin red de seguridad una carrera de arranque ajena
 *   que caiga justo en esos segundos; el peor caso es el comportamiento
 *   que había antes de este caché, y un logout es raro comparado con el
 *   riesgo que cubre.
 */
import type { MeForArea, PlatformRoleMe } from "@/lib/api/types";

/** Rotación ya aplicada en el backend, con o sin perfil recuperado. */
export type RotatedResult =
  | { kind: "ok"; refresh: string; access: string; user: MeForArea; platformRole: PlatformRoleMe }
  | { kind: "rotated-sin-perfil"; refresh: string };

/** Ventana en la que se repite el resultado de una rotación ya aplicada. */
export const ROTATION_REPLAY_TTL_MS = 3_000;

const recentlyRotated = new Map<string, { result: RotatedResult; expiresAt: number }>();

function purgeExpired(now: number): void {
  for (const [key, entry] of recentlyRotated) {
    if (entry.expiresAt <= now) recentlyRotated.delete(key);
  }
}

/** Guarda el resultado de rotar `refresh` (la clave es el token gastado). */
export function rememberRotation(refresh: string, result: RotatedResult): void {
  const now = Date.now();
  purgeExpired(now);
  recentlyRotated.set(refresh, { result, expiresAt: now + ROTATION_REPLAY_TTL_MS });
}

/** El resultado de una rotación reciente de `refresh`, o `null`. */
export function recallRotation(refresh: string): RotatedResult | null {
  purgeExpired(Date.now());
  return recentlyRotated.get(refresh)?.result ?? null;
}

/** Olvida todas las rotaciones guardadas (logout; también entre tests). */
export function clearRecentRotations(): void {
  recentlyRotated.clear();
}
