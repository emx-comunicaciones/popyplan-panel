/**
 * Fetch autenticado para Server Components / route handlers: recibe el
 * token explícito (nunca lee memoria de cliente, que no existe en el
 * servidor) y nunca reintenta — si el backend responde 401/403, quien
 * llama decide (normalmente `redirect('/login')`).
 */

const DEFAULT_API_URL = "http://localhost:8001";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

export type ServerFetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; body: unknown };

export async function serverFetch<T = unknown>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<ServerFetchResult<T>> {
  const response = await fetch(`${apiUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // sin cuerpo JSON (p. ej. 204 o error de proxy)
    }
    return { ok: false, status: response.status, body };
  }

  if (response.status === 204) {
    return { ok: true, status: response.status, data: undefined as T };
  }

  const text = await response.text();
  const data = (text ? JSON.parse(text) : undefined) as T;
  return { ok: true, status: response.status, data };
}
