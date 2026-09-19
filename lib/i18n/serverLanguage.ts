/**
 * Idioma de la petición actual, leído con `cookies()`/`headers()` de
 * `next/headers` (disponibles en Server Components y Route Handlers
 * dentro del ámbito de petición de Next; **no** en el runtime Edge del
 * middleware — ver `lib/i18n/requestLanguage.ts` para ese caso). Lo usa
 * `lib/api/serverFetch.ts` para mandar `Accept-Language` al backend.
 *
 * Fuera de un ámbito de petición real (scripts, o esta misma función
 * invocada en un test de Vitest sin mockear `next/headers`), las dos
 * llamadas lanzan — se captura y se cae a `es` en vez de reventar: en
 * producción esto solo ocurre si `serverFetch` se llamara fuera de un
 * Server Component/Route Handler, algo que no pasa hoy.
 */
import { cookies, headers } from "next/headers";

import { LANG_COOKIE_NAME, resolveLanguage } from "./cookie";
import { DEFAULT_LANGUAGE, type Language } from "./languages";

export async function getServerLanguage(): Promise<Language> {
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    return resolveLanguage({
      cookie: cookieStore.get(LANG_COOKIE_NAME)?.value,
      acceptLanguage: headerStore.get("accept-language"),
    });
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
