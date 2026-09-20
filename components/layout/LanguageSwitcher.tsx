"use client";

/**
 * Selector de idioma (spec de diseño `2026-09-19-i18n-es-eu-ca`, decisión
 * 7): un `<select>` compacto con los tres idiomas por su nombre completo
 * («Español · Euskara · Català», claves `language.*`) — en las tres
 * cabeceras de área, junto a `PageHelp`
 * (`app/{entidad,paraguas,plataforma}/**\/layout.tsx`), y en
 * `LoginForm.tsx`. Elegir un idioma:
 *
 * 1. Fija la cookie `pp_lang` (`POST /api/lang`, `app/api/lang/route.ts`).
 * 2. Si hay sesión (token en memoria, `lib/auth/tokenStore.ts`), intenta
 *    guardar la preferencia en la cuenta
 *    (`hooks/useUpdatePreferredLanguage.ts`, tolera cualquier fallo — la
 *    cookie ya decide el idioma de la interfaz).
 * 3. Invalida toda la caché de TanStack Query (M12 de la revisión final
 *    de la rama de i18n: sin esto, un `detail` verbatim del backend ya en
 *    caché se quedaba en el idioma anterior hasta que la query se
 *    refrescara por otro motivo).
 * 4. `router.refresh()` para que `app/layout.tsx` recoja el idioma nuevo
 *    de `getLocale()` (cookie → `Accept-Language` → `es`) y todo el
 *    árbol de Server Components (incluido `<html lang>`) se repinte sin
 *    una recarga completa.
 *
 * El idioma activo se lee con `useLocale()` de `next-intl`, no de
 * `document.documentElement.lang`: `useLocale()` sale del mismo
 * `NextIntlClientProvider` que `app/layout.tsx` ya fija en el servidor,
 * así que el valor coincide entre el render de servidor y el primer
 * render de cliente — leer `document.documentElement.lang` directamente
 * arriesgaría un desajuste de hidratación (`document` no existe durante
 * el render de servidor de este Client Component).
 *
 * `selected` (estado optimista) existe porque un `<select>` controlado
 * solo por `useLocale()` volvería visualmente al idioma anterior entre el
 * `change` y el `router.refresh()`: se pinta ya el elegido y, si la
 * cookie no se pudo fijar, se vuelve al idioma activo de verdad.
 *
 * Fondo blanco propio (I3 de la revisión final de la rama de i18n): este
 * control vive sobre la cabecera de marca, que con la entidad por defecto
 * es `primary-700` — `text-primary-700` solo es legible sobre blanco,
 * mismo criterio que `PageHelp` y que «Cerrar sesión».
 */
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";

import { getAccessToken } from "@/lib/auth/tokenStore";
import { SUPPORTED_LANGUAGES, type Language } from "@/lib/i18n/languages";
import { useUpdatePreferredLanguage } from "@/hooks/useUpdatePreferredLanguage";

export interface LanguageSwitcherProps {
  /**
   * Etiqueta «Idioma» visible (dentro del menú de cuenta,
   * `components/layout/UserMenu.tsx`) o solo para lectores de pantalla
   * (cabecera de `/login`, donde el control va suelto y compacto).
   */
  labelVisible?: boolean;
}

export function LanguageSwitcher({
  labelVisible = false,
}: LanguageSwitcherProps = {}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("language");
  const updatePreferredLanguage = useUpdatePreferredLanguage();
  const queryClient = useQueryClient();
  const selectId = useId();
  const [selected, setSelected] = useState<Language | null>(null);
  const [pending, setPending] = useState(false);

  async function handleChange(lang: Language) {
    if (pending || lang === locale) return;
    setSelected(lang);
    setPending(true);
    try {
      const response = await fetch("/api/lang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      if (!response.ok) {
        setSelected(null);
        return;
      }
      if (getAccessToken()) {
        // El hook ya traduce cualquier `ApiError` a `null` en vez de
        // lanzar (ver su docstring); el `.catch` de aquí solo cubre un
        // fallo que no sea de la API (p. ej. la propia petición no
        // llega a salir) — la cookie ya se fijó, así que igualmente hay
        // que refrescar.
        await updatePreferredLanguage.mutateAsync(lang).catch(() => null);
      }
      await queryClient.invalidateQueries();
      router.refresh();
    } catch {
      // La cookie no se pudo fijar (red caída): no hay nada que
      // refrescar, la interfaz sigue en el idioma que ya tenía.
      setSelected(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={labelVisible ? "flex flex-col gap-1" : "flex items-center"}>
      <label
        htmlFor={selectId}
        className={
          labelVisible ? "text-xs font-medium text-text-form" : "sr-only"
        }
      >
        {t("title")}
      </label>
      <select
        id={selectId}
        value={selected ?? locale}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value as Language)}
        className={`h-8 rounded-md border border-border bg-white px-2 text-sm font-medium text-text-form focus-visible:outline-primary-700 disabled:cursor-not-allowed disabled:opacity-50 ${labelVisible ? "w-full" : ""}`}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {t(lang)}
          </option>
        ))}
      </select>
    </div>
  );
}
