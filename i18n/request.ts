/**
 * Configuración de `next-intl` sin enrutado de idioma (spec de diseño
 * `2026-09-19-i18n-es-eu-ca`, decisión 7): las rutas, el middleware de
 * sesión y los e2e no cambian — el idioma sale de la cookie `pp_lang`
 * (`lib/i18n/serverLanguage.ts::getServerLanguage`, misma resolución
 * cookie → `Accept-Language` → `es` que usa `lib/api/serverFetch.ts`
 * para la cabecera del backend). Referenciado desde `next.config.ts`
 * (`createNextIntlPlugin('./i18n/request.ts')`); lo consumen
 * `app/layout.tsx` (`getLocale`/`getMessages`) y cualquier Server
 * Component que use `getTranslations`.
 */
import { getRequestConfig } from "next-intl/server";

import { getServerLanguage } from "@/lib/i18n/serverLanguage";

export default getRequestConfig(async () => {
  const locale = await getServerLanguage();
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
