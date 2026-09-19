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
 * Dos variantes comparten la misma lógica (`requestWithAuth`):
 *
 * - `apiFetch`: parsea el cuerpo JSON y lo devuelve (lo usan casi todos
 *   los hooks).
 * - `fetchWithAuth`: devuelve el `Response` sin parsear — para descargas
 *   de ficheros (`hooks/useExport.ts`, `hooks/useProgramReport.ts`), cuyo
 *   cuerpo no es JSON.
 *
 * Reparto de responsabilidades en el refresco:
 *
 * - 401 del backend original → `refreshAccessToken()`; si el reintento
 *   vuelve a dar 401 (el token recién rotado no sirve), limpia el token,
 *   notifica sesión expirada y lanza `ApiError` 401.
 * - 401 del route handler de refresco → la sesión caducó de verdad:
 *   mismo camino de logout.
 * - 5xx del route handler de refresco → `ApiError` con ese status,
 *   **sin** logout: es un fallo transitorio del backend y cerrar sesión
 *   aquí destruiría una sesión sana. El error se propaga como error de la
 *   consulta (la UI pinta su `ErrorState`) y la sesión sigue en pie para
 *   el siguiente intento: **no** hay reintento automático, porque
 *   `app/providers.tsx` fija `retry: false` para todas las queries.
 * - Error de red en el refresco → se trata como refresco fallido (logout),
 *   como antes.
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
import { apiBaseUrl } from "@/lib/api/baseUrl";
import { awaitBootRestore } from "@/lib/auth/bootSession";
import { notifySessionExpired, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/sessionEvents";
import { getAccessToken, setAccessToken } from "@/lib/auth/tokenStore";

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

/**
 * `Accept-Language` de cliente (spec de diseño `2026-09-19-i18n-es-eu-ca`,
 * decisión 5): igual que `document.documentElement.lang`, que
 * `app/layout.tsx` fija desde `getLocale()` (cookie `pp_lang` →
 * `Accept-Language` del navegador → `es`) y que el selector de idioma
 * actualiza sin recargar del todo (`router.refresh()`). Sin `document`
 * (fuera de un navegador — no ocurre en el uso real de `apiFetch`, solo
 * defensivo) no se añade la cabecera.
 */
function clientLanguageHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const lang = document.documentElement.lang;
  return lang ? { "Accept-Language": lang } : {};
}

async function rawRequest(
  path: string,
  token: string | null,
  options: ApiFetchOptions,
): Promise<Response> {
  const { body, headers, ...rest } = options;
  delete rest.skipRefresh;
  const formData = isFormData(body);
  return fetch(`${apiBaseUrl()}${path}`, {
    ...rest,
    headers: {
      ...(formData ? {} : { "Content-Type": "application/json" }),
      ...clientLanguageHeader(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : formData ? (body as FormData) : JSON.stringify(body),
  });
}

async function parseBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * Refresco contra `/api/session/refresh`. Distinción de estados (ver
 * docstring del módulo): 401 → `null` (la sesión caducó de verdad); 5xx →
 * `ApiError` con ese status (fallo transitorio, reintentable, sin logout);
 * error de red → `null` (como un refresco fallido).
 */
async function doRefreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/session/refresh", { method: "POST" });
    if (response.status === 401) return null;
    if (!response.ok) {
      throw new ApiError(response.status, await parseBody(response));
    }
    const data = (await response.json()) as { accessToken?: unknown };
    return typeof data.accessToken === "string" ? data.accessToken : null;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return null;
  }
}

/** Único refresco en vuelo compartido por todas las llamadas concurrentes. */
let inFlightRefresh: Promise<string | null> | null = null;

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

/**
 * Núcleo compartido por `apiFetch` y `fetchWithAuth`: resuelve el token
 * (esperando la restauración de arranque si la memoria está vacía),
 * dispara la petición y, ante un 401, refresca (single-flight) y reintenta
 * una vez. Devuelve el `Response` final ya verificado: en `!ok` lanza
 * `ApiError` con el cuerpo parseado.
 */
async function requestWithAuth(path: string, options: ApiFetchOptions): Promise<Response> {
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
    let newToken: string | null;
    try {
      newToken = await refreshAccessToken();
    } catch (error) {
      // 5xx del route handler de refresco: fallo transitorio; se propaga
      // como error de la consulta (sin reintento: `retry: false` en
      // `app/providers.tsx`), sin logout ni aviso de sesión expirada.
      if (error instanceof ApiError) throw error;
      newToken = null;
    }
    if (newToken) {
      setAccessToken(newToken);
      response = await rawRequest(path, newToken, { ...options, skipRefresh: true });
      if (response.status === 401) {
        // El token recién rotado tampoco sirve: la sesión es inservible.
        // Limpiar aquí evita que el token caducado se quede en memoria y
        // el ciclo 401→refresco se repita para siempre.
        setAccessToken(null);
        notifySessionExpired();
        throw new ApiError(401, null, SESSION_EXPIRED_MESSAGE);
      }
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

  return response;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const response = await requestWithAuth(path, options);

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Igual que `apiFetch` pero devuelve el `Response` sin parsear: para
 * descargas de ficheros (CSV/PDF, `hooks/useExport.ts` y
 * `hooks/useProgramReport.ts`), cuyo cuerpo no es JSON. Mismas reglas de
 * auth, refresco y `ApiError` en `!ok`.
 */
export async function fetchWithAuth(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  return requestWithAuth(path, options);
}
