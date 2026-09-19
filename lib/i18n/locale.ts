/**
 * Locale de `Intl` por idioma de interfaz (spec de diseño
 * `2026-09-19-i18n-es-eu-ca`, decisión 4): `es-ES`/`eu-ES`/`ca-ES` — los
 * tres son variedades de España, con idéntico separador de millares
 * (`.`) y decimal (`,`), comprobado con `Intl.NumberFormat` antes de
 * escribir este módulo. Por eso los formateadores de `lib/metrics/format.ts`
 * y `lib/programs/money.ts` pueden pasar a construirse por idioma sin que
 * ninguna cifra existente cambie de aspecto.
 */
import { DEFAULT_LANGUAGE, isSupportedLanguage, type Language } from "./languages";

const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  es: "es-ES",
  eu: "eu-ES",
  ca: "ca-ES",
};

export function localeFor(lang: Language): string {
  return LOCALE_BY_LANGUAGE[lang];
}

/**
 * Idioma activo para formatear fuera de un componente React (funciones
 * puras de `lib/metrics/format.ts`/`lib/programs/money.ts`, llamadas
 * tanto desde componentes de cliente como, en su primer render en el
 * servidor, sin DOM). En el cliente, `<html lang>` ya lo fija
 * `next-intl`/`app/layout.tsx` a partir de la cookie `pp_lang` — es la
 * misma fuente que usa `lib/api/client.ts` para `Accept-Language`. Sin
 * `document` (el primer render de un Client Component en el servidor,
 * antes de hidratar, o un test/script fuera del navegador) cae a `es`.
 *
 * **Solo los formateadores numéricos son inmunes a esa rama** (hallazgo
 * M19 de la revisión final de la rama de i18n): los tres locales
 * soportados formatean los números de forma idéntica (ver el docstring
 * del módulo), así que ahí esa rama nunca produce una cifra visible
 * distinta ni un `mismatch` de hidratación. **Las fechas no** —
 * `Intl.DateTimeFormat` sí difiere entre `es-ES`/`eu-ES`/`ca-ES`—, así
 * que dentro de un componente cliente que formatea una fecha, el
 * idioma correcto ya en el primer render de servidor exige `useLocale()`
 * de next-intl (con `localeForUseLocale`, más abajo), no esta función:
 * hoy no hay `mismatch` visible porque todas las fechas del panel salen
 * de datos de TanStack Query (`undefined` en SSR, se pinta el estado de
 * carga), pero eso es una propiedad accidental del panel, no de este
 * helper — cambia en cuanto alguien prefetchee una query en el servidor
 * o pase una fecha por props desde un Server Component.
 */
export function activeLanguage(): Language {
  if (typeof document === "undefined") return DEFAULT_LANGUAGE;
  const lang = document.documentElement.lang;
  return isSupportedLanguage(lang) ? lang : DEFAULT_LANGUAGE;
}

/**
 * `localeFor` para el valor de `useLocale()` de next-intl (tipado como
 * `string` a secas, no como `Language`): dentro de un Client Component,
 * `useLocale()` es correcto ya en el primer render de servidor —sale del
 * mismo `NextIntlClientProvider` que fija `app/layout.tsx`, sin el hueco
 * de `activeLanguage()` documentado en su propio docstring (solo
 * inmune para números, no para fechas)—, así que es la fuente preferida
 * para formatear una fecha dentro de un componente. En runtime siempre
 * es uno de los tres idiomas soportados (viene del mismo
 * `getServerLanguage()` que resuelve la petición), pero se narrows con
 * el mismo criterio defensivo que `activeLanguage()` por si acaso.
 */
export function localeForUseLocale(locale: string): string {
  return localeFor(isSupportedLanguage(locale) ? locale : DEFAULT_LANGUAGE);
}
