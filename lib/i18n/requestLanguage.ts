/**
 * Cabecera `Accept-Language` a partir de una petición entrante
 * (`middleware.ts`, en runtime Edge, y las llamadas de auth de
 * `app/api/session/route.ts`/`app/api/session/refresh/route.ts`): cookie
 * `pp_lang` → `Accept-Language` del navegador → `es`
 * (`lib/i18n/cookie.ts::resolveLanguage`). A diferencia de
 * `lib/i18n/serverLanguage.ts` (que usa `cookies()`/`headers()` de
 * `next/headers`, solo disponibles en Server Components y Route
 * Handlers reales dentro del ámbito de petición de Next), esto lee
 * directamente los campos de la petición — funciona también en el
 * runtime Edge del middleware, que no puede usar `next/headers`. Mismo
 * patrón que `lib/auth/clientIp.ts::forwardedForHeaders`.
 */
import { LANG_COOKIE_NAME, resolveLanguage } from "./cookie";

interface RequestLike {
  cookies: { get(name: string): { value: string } | undefined };
  headers: Headers;
}

export function requestLanguageHeader(request: RequestLike): { "Accept-Language": string } {
  return {
    "Accept-Language": resolveLanguage({
      cookie: request.cookies.get(LANG_COOKIE_NAME)?.value,
      acceptLanguage: request.headers.get("accept-language"),
    }),
  };
}
