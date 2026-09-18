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
 *
 * **Frontera de confianza (hallazgo F4, trade-off asumido):** este módulo
 * reenvía el **primer** valor de la cabecera entrante *tal cual*, sin
 * poder distinguir si lo puso el proxy o el propio cliente. Por tanto, el
 * proxy que haya delante de Next tiene que **fijar** `X-Forwarded-For`
 * (en nginx, `proxy_set_header X-Forwarded-For $remote_addr`), **nunca
 * anexar** al valor entrante (`$proxy_add_x_forwarded_for`): si lo anexa,
 * el primer elemento es el que mandó quien llama, y basta rotarlo en cada
 * intento para saltarse el límite de login del backend (5/minuto por
 * `ip:<ip>:auth`, `users/rate_limiting.py`). La alternativa —descartar la
 * cabecera entrante— no sirve: el panel siempre va detrás de un proxy en
 * producción y sin ella todas las peticiones de auth saldrían con la IP
 * del proceso de Next, que es justo el 429 global que arregló A1. El
 * arreglo duradero es del repo backend: clavar el límite por endpoint (o
 * por cuenta) en vez de solo por IP, y declarar allí la lista de proxies
 * de confianza. Anotado en `.env.example` («Notas de despliegue») y en
 * CLAUDE.md.
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
