/**
 * Idiomas de interfaz del panel (spec de diseño `2026-09-19-i18n-es-eu-ca`,
 * decisión 1): `es` (por defecto), `eu` y `ca`. El inglés (`en`) es la
 * cadena fuente del código (`messages/en.json`, decisión 2 del diseño) y
 * **nunca** se ofrece a las personas como idioma de interfaz — por eso no
 * aparece aquí, aunque `messages/en.json` exista como referencia de
 * traducción y para el test de paridad (`lib/i18n/messages.test.ts`).
 */
export const SUPPORTED_LANGUAGES = ["es", "eu", "ca"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "es";

/** `true` (y estrecha el tipo) si `value` es uno de los tres idiomas ofrecidos. */
export function isSupportedLanguage(value: string | null | undefined): value is Language {
  if (!value) return false;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
