/**
 * Fetch autenticado para componentes de cliente (hooks de TanStack Query,
 * mutaciones). Añade `Authorization: Bearer` desde el token en memoria
 * (`lib/auth/tokenStore.ts`); si el backend responde 401, intenta refrescar
 * contra el route handler propio `/api/session/refresh` (que a su vez rota
 * el refresh token guardado en la cookie httpOnly — ver `lib/auth/cookie.ts`)
 * y reintenta la petición original; si el refresco falla, limpia el token
 * en memoria (logout), avisa a `lib/auth/sessionEvents.ts` y lanza
 * `ApiError`.
 *
 * **Bug crítico de demo (2026-09-05, ver `lib/auth/bootSession.ts`):** en
 * una demo en vivo, recargar `/entidad/<slug>/…` disparaba varias
 * peticiones en paralelo con el token en memoria vacío. Cada una recibía
 * 401 y llamaba por su cuenta a `/api/session/refresh` con la MISMA cookie
 * de refresh; como el backend rota y invalida el refresh anterior en cada
 * uso (`ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`), solo la
 * primera llamada concurrente tenía éxito — el resto recibía 401 del
 * propio refresco y la app cerraba la sesión de quien acababa de entrar.
 * Dos piezas lo arreglan:
 *
 * 1. **Un único refresco en vuelo** (`inFlightRefresh` más abajo): toda
 *    llamada a `refreshAccessToken()` mientras hay una en curso reutiliza
 *    la misma promesa en vez de disparar otra petición — así, aunque
 *    lleguen varios 401 a la vez, `/api/session/refresh` se llama una sola
 *    vez.
 * 2. **Esperar la restauración de arranque** (`awaitBootRestore()`):
 *    cuando no hay token en memoria, `apiFetch` espera a que
 *    `app/providers.tsx` termine de restaurar la sesión antes de disparar
 *    la petición, en vez de lanzarla ya con el token vacío (lo que
 *    provocaría el 401 innecesario que dispara el punto 1).
 */
import { awaitBootRestore } from "@/lib/auth/bootSession";
import { notifySessionExpired, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/sessionEvents";
import { getAccessToken, setAccessToken } from "@/lib/auth/tokenStore";

const DEFAULT_API_URL = "http://localhost:8001";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Uso interno: evita reintentar el refresco en la petición ya reintentada. */
  skipRefresh?: boolean;
}

/**
 * Un recurso con fichero (`docs/PANEL.md` §7.3) manda `multipart/form-data`:
 * si `body` ya es un `FormData` (construido por quien llama, p. ej.
 * `hooks/useCreateResource.ts`), se envía tal cual, sin `JSON.stringify` ni
 * forzar `Content-Type` (el navegador añade el `boundary` correcto solo si
 * no se fija la cabecera a mano).
 */
function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

async function rawRequest(
  path: string,
  token: string | null,
  options: ApiFetchOptions,
): Promise<Response> {
  const { body, headers, ...rest } = options;
  delete rest.skipRefresh;
  const formData = isFormData(body);
  return fetch(`${apiUrl()}${path}`, {
    ...rest,
    headers: {
      ...(formData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : formData ? (body as FormData) : JSON.stringify(body),
  });
}

/** Único refresco en vuelo compartido por todas las llamadas concurrentes. */
let inFlightRefresh: Promise<string | null> | null = null;

async function doRefreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/session/refresh", { method: "POST" });
    if (!response.ok) return null;
    const data = (await response.json()) as { accessToken?: unknown };
    return typeof data.accessToken === "string" ? data.accessToken : null;
  } catch {
    return null;
  }
}

/**
 * Llama al route handler propio, nunca directamente al backend. Si ya hay
 * un refresco en curso, todas las llamadas comparten su resultado en vez
 * de disparar una petición cada una (ver docstring del módulo).
 */
function refreshAccessToken(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = doRefreshAccessToken().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function parseBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  let token = getAccessToken();
  if (!token) {
    // Sin token en memoria: puede ser que la app acabe de arrancar y
    // `app/providers.tsx` todavía esté restaurando la sesión (recarga
    // completa de página) — esperar evita el 401 innecesario que
    // dispararía un refresco por cada petición concurrente.
    await awaitBootRestore();
    token = getAccessToken();
  }
  let response = await rawRequest(path, token, options);

  if (response.status === 401 && !options.skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      setAccessToken(newToken);
      response = await rawRequest(path, newToken, { ...options, skipRefresh: true });
    } else {
      setAccessToken(null);
      notifySessionExpired();
      throw new ApiError(401, null, SESSION_EXPIRED_MESSAGE);
    }
  }

  if (!response.ok) {
    const body = await parseBody(response);
    throw new ApiError(response.status, body, `Error ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
