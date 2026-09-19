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
 * 3. Invalida toda la caché de TanStack Query (M12 de la revisión final
 *    de la rama: sin esto, un `detail` verbatim del backend ya en caché
 *    se quedaba en el idioma anterior hasta que la query se refrescara
 *    por otro motivo).
 * 4. `router.refresh()` para que `app/layout.tsx` recoja el idioma nuevo
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
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { getAccessToken } from "@/lib/auth/tokenStore";
import { SUPPORTED_LANGUAGES, type Language } from "@/lib/i18n/languages";
import { useUpdatePreferredLanguage } from "@/hooks/useUpdatePreferredLanguage";

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("language");
  const updatePreferredLanguage = useUpdatePreferredLanguage();
  const queryClient = useQueryClient();
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
      // M12 de la revisión final de la rama: sin esto, los `detail`
      // verbatim del backend que `errorKindText` prioriza (y que con la
      // i18n del backend llegarán ya traducidos) se quedaban en el
      // idioma anterior hasta que la query se refrescara por otro
      // motivo. Antes de `router.refresh()`, que solo repinta el árbol
      // de Server Components.
      await queryClient.invalidateQueries();
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
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = lang === locale;
        return (
          <Button
            key={lang}
            type="button"
            // Fondo blanco fijo para los tres (hallazgo I3 de la
            // revisión final de la rama de i18n): `variant="primary"`
            // en el botón activo (`bg-primary-700`) se confundía con la
            // cabecera de la entidad por defecto, que también usa
            // `primary-700` — mismo arreglo que `PageHelp.tsx` en
            // `a41bde5`. El activo se distingue por `font-semibold` y un
            // borde marcado, no solo por color, además de
            // `aria-pressed` (que ya era correcto).
            variant="secondary"
            aria-pressed={isActive}
            aria-label={t(lang)}
            disabled={pending !== null}
            onClick={() => handleClick(lang)}
            className={`h-10 px-3 text-xs uppercase ${
              isActive ? "border-2 border-primary-700 font-semibold" : "font-medium"
            }`}
          >
            {lang.toUpperCase()}
          </Button>
        );
      })}
    </div>
  );
}
