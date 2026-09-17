/**
 * Fetch autenticado para Server Components / route handlers: recibe el
 * token explícito (nunca lee memoria de cliente, que no existe en el
 * servidor) y nunca reintenta — si el backend responde 401/403, quien
 * llama decide (normalmente `redirect('/login')`). Un 200 con cuerpo no
 * JSON (p. ej. HTML de un proxy caído) se trata como error, no revienta:
 * el parse protegido devuelve `{ ok: false }` como cualquier otro fallo.
 */
import { apiBaseUrl } from "./baseUrl";

export type ServerFetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; body: unknown };

export async function serverFetch<T = unknown>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<ServerFetchResult<T>> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
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
  try {
    const data = (text ? JSON.parse(text) : undefined) as T;
    return { ok: true, status: response.status, data };
  } catch {
    // 200 con cuerpo no JSON (p. ej. HTML de un proxy): mismo tratamiento
    // que el camino de error, para no reventar el render con SyntaxError.
    return { ok: false, status: response.status, body: null };
  }
}
