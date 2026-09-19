"use client";

/**
 * `PATCH /api/users/users/update_profile/ {preferred_language}`
 * (`lib/api/endpoints.ts::USERS.UPDATE_PROFILE`, spec de diseño
 * `2026-09-19-i18n-es-eu-ca`, decisión 2): guarda el idioma elegido en
 * la cuenta cuando hay sesión. La cookie `pp_lang`
 * (`app/api/lang/route.ts`) es la que de verdad decide el idioma de la
 * interfaz — esta llamada es solo para que la próxima vez que la
 * persona entre desde otro dispositivo (o tras borrar cookies)
 * `hooks/useAuth.ts::applyAccountLanguage` pueda recuperarlo — así que
 * tolera cualquier fallo (400 si el backend aún no tiene el campo
 * desplegado, 401 sin token en memoria, red caída…) sin propagarlo:
 * `components/layout/LanguageSwitcher.tsx` no tiene nada que mostrar
 * por un fallo aquí, y no vale la pena distinguir el motivo.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { USERS } from "@/lib/api/endpoints";
import type { Language } from "@/lib/i18n/languages";
import type { UpdatePreferredLanguageResponse } from "@/lib/api/types";

export function useUpdatePreferredLanguage(): UseMutationResult<
  UpdatePreferredLanguageResponse | null,
  Error,
  Language
> {
  return useMutation<UpdatePreferredLanguageResponse | null, Error, Language>({
    mutationFn: async (lang) => {
      try {
        return await apiFetch<UpdatePreferredLanguageResponse>(USERS.UPDATE_PROFILE, {
          method: "PATCH",
          body: { preferred_language: lang },
        });
      } catch (error) {
        if (error instanceof ApiError) return null;
        throw error;
      }
    },
  });
}
