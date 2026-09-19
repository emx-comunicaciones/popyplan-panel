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
 * antes de hidratar, o un test/script fuera del navegador) cae a `es`:
 * no hay forma síncrona de leer el idioma de la petición ahí, pero como
 * los tres locales soportados formatean los números de forma idéntica
 * (ver el docstring del módulo), esa rama nunca produce una cifra visible
 * distinta ni un `mismatch` de hidratación.
 */
export function activeLanguage(): Language {
  if (typeof document === "undefined") return DEFAULT_LANGUAGE;
  const lang = document.documentElement.lang;
  return isSupportedLanguage(lang) ? lang : DEFAULT_LANGUAGE;
}
