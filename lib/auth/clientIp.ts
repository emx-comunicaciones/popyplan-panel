/**
 * Reenvío de la IP real del navegador al backend en las llamadas que el
 * servidor de Next hace por su cuenta (`middleware.ts`,
 * `app/api/session/route.ts`, `app/api/session/refresh/route.ts`).
 *
 * **Por qué importa (hallazgo A1 de la auditoría 2026-09-18):** el
 * backend limita por IP con una clave compartida por grupo de endpoints
 * (`users/rate_limiting.py`): `ip:<ip>:auth` cubre a la vez
 * `POST /api/auth/login/` (5 intentos/minuto) y
 * `POST /api/auth/token/refresh/` (100/minuto), y `is_rate_limited`
 * guarda todas las marcas de tiempo en la misma lista. Como el panel
 * llama al backend **desde el servidor**, sin esta cabecera todas las
 * peticiones llegan con la IP del proceso de Next: con cinco refrescos
 * de sesión en el último minuto (una navegación por página), el login de
 * cualquier persona responde 429.
 *
 * `users/rate_limiting.py::get_client_ip` lee `HTTP_X_FORWARDED_FOR` y se
 * queda con el **primer** elemento de la lista; si no viene, usa
 * `REMOTE_ADDR`. Por eso aquí se manda una sola IP —la del cliente— y no
 * la lista entera: el backend no tiene lista de proxies de confianza, así
 * que encadenar valores dejaría la clave a merced de quien envíe la
 * cabecera. El valor que se propaga es el que ya puso el proxy de entrada
 * del panel (`x-forwarded-for` o, si no, `x-real-ip`).
 */

/** Primer valor no vacío de una lista `a, b, c`. */
function firstValue(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first ? first : null;
}

/**
 * Cabeceras a añadir al `fetch` hacia el backend: `{ "X-Forwarded-For":
 * <ip> }` o `{}` si la petición entrante no trae ninguna IP de cliente
 * (p. ej. en desarrollo local, donde el backend ya ve la IP real).
 */
export function forwardedForHeaders(request: { headers: Headers }): Record<string, string> {
  const ip =
    firstValue(request.headers.get("x-forwarded-for")) ??
    firstValue(request.headers.get("x-real-ip"));
  return ip ? { "X-Forwarded-For": ip } : {};
}
