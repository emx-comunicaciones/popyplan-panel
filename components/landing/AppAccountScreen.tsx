import Image from "next/image";
import { useTranslations } from "next-intl";

import { LogoutButton } from "@/components/LogoutButton";
import { Footer } from "@/components/layout/Footer";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

import { LANDING_FONT_CLASS } from "./fonts";
import { DARK_BUTTON_CLASS } from "./linkStyles";
import { StoreLinks } from "./StoreLinks";

/**
 * «Tu cuenta es de la app» (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §5, decisión 4): lo que ve
 * quien entra con una cuenta **sin ningún rol de panel** — una persona
 * usuaria de la app. Sustituye al `ErrorState` «No tienes acceso a
 * ningún área del panel» que había antes, que era correcto pero se leía
 * como un fallo del sistema y no ofrecía ninguna salida útil.
 *
 * Restilada con el rediseño de la landing (2026-09-20): mismas
 * tipografías (`LANDING_FONT_CLASS`), mismo logo y misma cabecera que la
 * web pública, sin el enlace «Entrar» (aquí ya hay sesión) y con el
 * selector de idioma, que es la única forma de cambiarlo en esta
 * pantalla. El texto ya no menciona asociaciones ni administraciones:
 * quien llega aquí es una persona usuaria, y lo único útil que se le
 * puede decir es dónde está su sitio.
 *
 * `LogoutButton` y `LanguageSwitcher` son Client Components;
 * renderizarlos desde un Server Component es el patrón normal de App
 * Router (las tres cabeceras de área ya lo hacen). El enlace «Abrir la
 * app» usa el esquema propio `popyplan://`: si la app no está instalada,
 * el navegador simplemente no hace nada — por eso los botones de tienda
 * van justo encima.
 *
 * Mantiene el pie común del panel (`components/layout/Footer.tsx`, con
 * el enlace a la declaración de accesibilidad) y no el pie de la
 * landing: esta pantalla no tiene anclas de sección ni columnas de
 * descargas que repetir.
 */
export function AppAccountScreen() {
  const t = useTranslations("landing.appAccount");
  const tHeader = useTranslations("landing.header");

  return (
    <div className={`${LANDING_FONT_CLASS} flex min-h-screen flex-col bg-white text-text-base`}>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-3 lg:px-12">
          <Image
            src="/landing/logo.svg"
            alt={tHeader("logoAlt")}
            width={79}
            height={52}
            unoptimized
            className="h-10 w-auto sm:h-12"
          />
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-3 font-display text-[28px] font-bold leading-tight text-text-base">
            {t("title")}
          </h1>
          <p className="mb-6 text-[17px] leading-snug text-text-base">{t("description")}</p>
          <div className="mb-6">
            <StoreLinks label={t("storesLabel")} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href="popyplan://" className={DARK_BUTTON_CLASS}>
              {t("openApp")}
            </a>
            <LogoutButton />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
