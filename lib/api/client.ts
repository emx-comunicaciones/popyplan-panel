/**
 * Fetch autenticado para componentes de cliente (hooks de TanStack Query,
 * mutaciones). Añade `Authorization: Bearer` desde el token en memoria
 * (`lib/auth/tokenStore.ts`); si el backend responde 401, intenta refrescar
 * una vez contra el route handler propio `/api/session/refresh` (que a su
 * vez valida el access token guardado en la cookie httpOnly — ver
 * `lib/auth/cookie.ts` para la desviación sobre el refresh token) y
 * reintenta la petición original; si el refresco falla, limpia el token
 * en memoria (logout) y lanza `ApiError`.
 */
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

async function rawRequest(
  path: string,
  token: string | null,
  options: ApiFetchOptions,
): Promise<Response> {
  const { body, headers, ...rest } = options;
  delete rest.skipRefresh;
  return fetch(`${apiUrl()}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Llama al route handler propio, nunca directamente al backend. */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/session/refresh", { method: "POST" });
    if (!response.ok) return null;
    const data = (await response.json()) as { accessToken?: unknown };
    return typeof data.accessToken === "string" ? data.accessToken : null;
  } catch {
    return null;
  }
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
  const token = getAccessToken();
  let response = await rawRequest(path, token, options);

  if (response.status === 401 && !options.skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      setAccessToken(newToken);
      response = await rawRequest(path, newToken, { ...options, skipRefresh: true });
    } else {
      setAccessToken(null);
      throw new ApiError(401, null, "Sesión caducada, inicia sesión de nuevo.");
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
