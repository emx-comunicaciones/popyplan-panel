/**
 * Fija el idioma de interfaz elegido en la cookie `pp_lang` (spec de
 * diseño `2026-09-19-i18n-es-eu-ca`, decisión 2). Lo llama el selector de
 * idioma (`components/layout/LanguageSwitcher.tsx`, tarea 6) y luego
 * hace `router.refresh()` para que `i18n/request.ts` recoja la cookie
 * nueva en la siguiente petición al servidor.
 */
import { NextRequest, NextResponse } from "next/server";

import { LANG_COOKIE_NAME, langCookieOptions } from "@/lib/i18n/cookie";
import { isSupportedLanguage } from "@/lib/i18n/languages";

interface LangBody {
  lang?: unknown;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as LangBody | null;
  const lang = body?.lang;

  if (typeof lang !== "string" || !isSupportedLanguage(lang)) {
    return NextResponse.json({ detail: "Idioma no soportado." }, { status: 400 });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(LANG_COOKIE_NAME, lang, langCookieOptions());
  return response;
}
