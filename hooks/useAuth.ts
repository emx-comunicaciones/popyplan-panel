"use client";

/**
 * Login/logout/restauración de sesión para componentes de cliente. El
 * access token vive en `lib/auth/tokenStore.ts` (memoria, nunca
 * localStorage); estas funciones son las únicas que hablan con
 * `app/api/session/*` (nunca directamente con el backend desde el
 * navegador, para no exponer la cookie httpOnly ni la URL del backend
 * en el login).
 */
import { useSyncExternalStore } from "react";

import { ApiError } from "@/lib/api/client";
import { setAccessToken, subscribeAccessToken, getAccessToken } from "@/lib/auth/tokenStore";
import { LANG_COOKIE_NAME } from "@/lib/i18n/cookie";
import { isSupportedLanguage } from "@/lib/i18n/languages";
import type { MeForArea, PlatformRoleMe } from "@/lib/api/types";

export interface SessionData {
  accessToken: string;
  user: MeForArea;
  platformRole: PlatformRoleMe;
}

/** Token reactivo: se actualiza solo si algo llama a `setAccessToken`. */
export function useAccessToken(): string | null {
  return useSyncExternalStore(subscribeAccessToken, getAccessToken, () => null);
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function login(usernameOrEmail: string, password: string): Promise<SessionData> {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new ApiError(response.status, data, "No se pudo iniciar sesión.");
  }
  const session = data as SessionData;
  setAccessToken(session.accessToken);
  return session;
}

/**
 * Restauración de arranque, una sola por carga de página (hallazgo M1).
 *
 * `app/providers.tsx` lanza la restauración desde el inicializador
 * perezoso de un `useState`, que **el StrictMode de React ejecuta dos
 * veces** en desarrollo (y `next dev` es lo que corre el e2e): sin este
 * guard salían dos `POST /api/session/refresh` concurrentes con la misma
 * cookie. El route handler ya los agrupa (`singleFlight`), pero lo
 * barato es no disparar la segunda petición siquiera; el guard vive a
 * nivel de módulo, así que se reinicia solo con cada carga completa de
 * página, que es exactamente lo que se quiere restaurar.
 */
let bootRestorePromise: Promise<SessionData | null> | null = null;

export function bootRestoreSession(): Promise<SessionData | null> {
  bootRestorePromise ??= restoreSession();
  return bootRestorePromise;
}

/** Solo para tests: vuelve al estado inicial entre casos. */
export function resetBootRestoreSessionForTests(): void {
  bootRestorePromise = null;
}

/** Restaura la sesión al arrancar la app (recarga de página). */
export async function restoreSession(): Promise<SessionData | null> {
  const response = await fetch("/api/session/refresh", { method: "POST" });
  if (!response.ok) {
    setAccessToken(null);
    return null;
  }
  const session = (await parseJson(response)) as SessionData;
  setAccessToken(session.accessToken);
  return session;
}

/** `pp_lang` actual, leída directamente de `document.cookie` (sin `document` — SSR de un Client Component — no hay nada que leer). */
function currentLangCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${LANG_COOKIE_NAME}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(LANG_COOKIE_NAME.length + 1));
}

/**
 * Idioma de la cuenta al entrar (spec de diseño `2026-09-19-i18n-es-eu-ca`,
 * decisión 2, último párrafo): si `preferred_language` viene no vacío y
 * distinto de la cookie `pp_lang` actual, fija la cookie con el mismo
 * route handler que usa el selector de idioma
 * (`components/layout/LanguageSwitcher.tsx`, `app/api/lang/route.ts`) y
 * devuelve `true` — quien llama (`LoginForm.tsx` tras `login()`,
 * `app/providers.tsx` tras `bootRestoreSession()`, los dos únicos sitios
 * con `useRouter()` a mano) decide entonces si hace falta
 * `router.refresh()` para que `app/layout.tsx` recoja el idioma nuevo de
 * `getLocale()`. Nunca lanza: un fallo aquí (red caída) no debe romper
 * el login ni el arranque de la app, la interfaz sigue en el idioma que
 * ya tenía.
 */
export async function applyAccountLanguage(user: MeForArea): Promise<boolean> {
  const preferred = user.preferred_language;
  if (!isSupportedLanguage(preferred) || currentLangCookie() === preferred) {
    return false;
  }
  try {
    await fetch("/api/lang", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: preferred }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Timeout del `DELETE /api/session`: el logout es best-effort (la cookie
 * httpOnly la borra el navegador al aplicar la respuesta), así que un
 * backend colgado no puede dejar «Cerrando sesión…» para siempre.
 */
const LOGOUT_TIMEOUT_MS = 5000;

export async function logout(): Promise<void> {
  setAccessToken(null);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
  try {
    await fetch("/api/session", { method: "DELETE", signal: controller.signal });
  } catch {
    // Best-effort: la cookie se borra aunque el backend no responda
    // (abort por timeout o red caída) — el refresh expirará solo.
  } finally {
    clearTimeout(timeout);
  }
}
