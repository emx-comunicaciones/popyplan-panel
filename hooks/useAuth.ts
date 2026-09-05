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

export async function logout(): Promise<void> {
  setAccessToken(null);
  await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
}
