/**
 * Cookie de idioma del panel (spec de diseño `2026-09-19-i18n-es-eu-ca`,
 * decisión 7: «idioma por cookie `pp_lang`»). No es `httpOnly`: el
 * selector de idioma (`components/layout/LanguageSwitcher.tsx`, tarea 6)
 * y `document.documentElement.lang` la necesitan legible desde el
 * cliente para saber cuál está activo, y no guarda ningún dato sensible.
 * `sameSite: 'lax'` y un año de vida, igual criterio que
 * `lib/auth/cookie.ts` salvo por `httpOnly` (esa sí lo es: guarda un
 * refresh token).
 */
import { DEFAULT_LANGUAGE, isSupportedLanguage, type Language } from "./languages";

export const LANG_COOKIE_NAME = "pp_lang";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface LangCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

export function langCookieOptions(): LangCookieOptions {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  };
}

export interface ResolveLanguageInput {
  cookie?: string | null;
  acceptLanguage?: string | null;
}

/**
 * Idioma de una petición (decisión 1 del diseño): cookie `pp_lang` →
 * `Accept-Language` del navegador → `es`. `Accept-Language` puede traer
 * varios idiomas con calidad (`eu-ES,eu;q=0.9,es;q=0.8`); se toma el
 * primero, ordenado por `;q=` **descendente** (M2 de la revisión final
 * de la rama de i18n: antes se tomaba el primero en orden de
 * *aparición*, sin mirar `q` — los navegadores ya mandan la cabecera
 * ordenada por calidad, así que en la práctica no fallaba, pero un
 * cliente que no ordene, o un proxy que reescriba la cabecera, obtenía
 * el idioma equivocado), cuyo idioma base (antes del `-` de región) esté
 * entre los tres soportados, ignorando los que no lo estén (p. ej. `de`).
 * Sin `q` explícito, la calidad es 1 (RFC 9110 §12.5.1); el orden es
 * estable, así que dos idiomas con la misma calidad conservan su orden
 * de aparición original.
 */
export function resolveLanguage(input: ResolveLanguageInput): Language {
  if (isSupportedLanguage(input.cookie)) return input.cookie;

  const acceptLanguage = input.acceptLanguage;
  if (acceptLanguage) {
    const entries = acceptLanguage
      .split(",")
      .map((part, index) => {
        const [tagPart, ...params] = part.split(";");
        const tag = tagPart?.trim();
        const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
        const quality = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
        return { tag, quality: Number.isFinite(quality) ? quality : 1, index };
      })
      .sort((a, b) => b.quality - a.quality || a.index - b.index);

    for (const { tag } of entries) {
      const base = tag?.split("-")[0]?.toLowerCase();
      if (isSupportedLanguage(base)) return base;
    }
  }

  return DEFAULT_LANGUAGE;
}
