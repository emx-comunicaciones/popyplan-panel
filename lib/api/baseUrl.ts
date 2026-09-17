/**
 * URL base del backend Django, única para todo el panel (hallazgo B9).
 *
 * Antes cada capa (`lib/api/client.ts`, `lib/api/serverFetch.ts`,
 * `middleware.ts` y los dos route handlers de sesión) repetía el mismo
 * `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001"`: cinco
 * copias del mismo literal y, sobre todo, un panel de producción
 * desplegado sin la variable apuntando en silencio a `localhost` (todas
 * las peticiones fallan sin decir por qué).
 *
 * Reglas:
 *
 * - Con la variable definida, se devuelve **sin barra final** — las rutas
 *   de `lib/api/endpoints.ts` ya empiezan por `/`, así que una barra de
 *   más produciría `https://host//api/...`.
 * - Sin ella (o vacía), en producción se lanza; en desarrollo, test y
 *   e2e se cae al backend local de siempre.
 *
 * **Siempre en tiempo de petición, nunca a nivel de módulo**: un
 * `apiBaseUrl()` evaluado al importar haría fallar `next build` sin la
 * variable en el entorno de construcción (el valor real lo pone el
 * despliegue). Sin dependencias de Node: `middleware.ts` corre en el
 * runtime de middleware, donde solo hay `process.env`.
 */
const DEFAULT_API_URL = "http://localhost:8001";

export function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL no está definida");
  }

  return DEFAULT_API_URL;
}
