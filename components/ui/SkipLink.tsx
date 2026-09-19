"use client";

/**
 * Enlace «Saltar al contenido» (tarea W6, accesibilidad): invisible
 * hasta que recibe el foco (primer elemento tabulable de la página),
 * para que quien navega con teclado no tenga que pasar por todo el
 * menú lateral en cada página. Apunta a `#main-content`, el `<main>`
 * de cada layout de área (`app/{entidad,paraguas,plataforma}/.../layout.tsx`),
 * que lleva `tabIndex={-1}` para poder recibir el foco aunque no sea
 * nativamente enfocable.
 *
 * Componente de cliente (tarea i18n 2): `useTranslations` necesita el
 * `NextIntlClientProvider` del layout raíz; se monta igual dentro de los
 * tres layouts de área, que son Server Components, como ya hacían
 * `LogoutButton`/`PageHelp`.
 */
import { useTranslations } from "next-intl";

export function SkipLink() {
  const t = useTranslations("ui");

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-text-inverse focus-visible:outline-primary-700"
    >
      {t("skipLink")}
    </a>
  );
}
