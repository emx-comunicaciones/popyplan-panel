"use client";

/**
 * Selector de idioma (spec de diseño `2026-09-19-i18n-es-eu-ca`, decisión
 * 7): tres botones «ES · EU · CA» — en las tres cabeceras de área, junto
 * a `PageHelp` (`app/{entidad,paraguas,plataforma}/**\/layout.tsx`), y en
 * `LoginForm.tsx`. Un clic:
 *
 * 1. Fija la cookie `pp_lang` (`POST /api/lang`, `app/api/lang/route.ts`).
 * 2. Si hay sesión (token en memoria, `lib/auth/tokenStore.ts`), intenta
 *    guardar la preferencia en la cuenta
 *    (`hooks/useUpdatePreferredLanguage.ts`, tolera cualquier fallo — la
 *    cookie ya decide el idioma de la interfaz).
 * 3. `router.refresh()` para que `app/layout.tsx` recoja el idioma nuevo
 *    de `getLocale()` (cookie → `Accept-Language` → `es`) y todo el
 *    árbol de Server Components (incluido `<html lang>`) se repinte sin
 *    una recarga completa.
 *
 * El idioma activo (para `aria-pressed`) se lee con `useLocale()` de
 * `next-intl`, no de `document.documentElement.lang`: `useLocale()` sale
 * del mismo `NextIntlClientProvider` que `app/layout.tsx` ya fija en el
 * servidor, así que el valor coincide entre el render de servidor y el
 * primer render de cliente — leer `document.documentElement.lang`
 * directamente arriesgaría un desajuste de hidratación (`document` no
 * existe durante el render de servidor de este Client Component).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { getAccessToken } from "@/lib/auth/tokenStore";
import { SUPPORTED_LANGUAGES, type Language } from "@/lib/i18n/languages";
import { useUpdatePreferredLanguage } from "@/hooks/useUpdatePreferredLanguage";

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("language");
  const updatePreferredLanguage = useUpdatePreferredLanguage();
  const [pending, setPending] = useState<Language | null>(null);

  async function handleClick(lang: Language) {
    if (pending || lang === locale) return;
    setPending(lang);
    try {
      const response = await fetch("/api/lang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      if (!response.ok) return;
      if (getAccessToken()) {
        // El hook ya traduce cualquier `ApiError` a `null` en vez de
        // lanzar (ver su docstring); el `.catch` de aquí solo cubre un
        // fallo que no sea de la API (p. ej. la propia petición no
        // llega a salir) — la cookie ya se fijó, así que igualmente hay
        // que refrescar.
        await updatePreferredLanguage.mutateAsync(lang).catch(() => null);
      }
      router.refresh();
    } catch {
      // La cookie no se pudo fijar (red caída): no hay nada que
      // refrescar, la interfaz sigue en el idioma que ya tenía.
    } finally {
      setPending(null);
    }
  }

  return (
    <div role="group" aria-label={t("title")} className="flex items-center gap-1">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <Button
          key={lang}
          type="button"
          variant={lang === locale ? "primary" : "secondary"}
          aria-pressed={lang === locale}
          aria-label={t(lang)}
          disabled={pending !== null}
          onClick={() => handleClick(lang)}
          className="h-10 px-3 text-xs font-semibold uppercase"
        >
          {lang.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
