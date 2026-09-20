import { useTranslations } from "next-intl";

import { LogoutButton } from "@/components/LogoutButton";
import { Footer } from "@/components/layout/Footer";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

import { PRIMARY_LINK_CLASS } from "./linkStyles";
import { StoreLinks } from "./StoreLinks";

/**
 * «Tu cuenta es de la app» (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §5, decisión 4): lo que ve
 * quien entra con una cuenta **sin ningún rol de panel** — una persona
 * usuaria de la app. Sustituye al `ErrorState` «No tienes acceso a ningún
 * área del panel» que había antes, que era correcto pero se leía como un
 * fallo del sistema y no ofrecía ninguna salida útil.
 *
 * `LogoutButton` y `LanguageSwitcher` son Client Components; renderizarlos
 * desde un Server Component es el patrón normal de App Router (las tres
 * cabeceras de área ya lo hacen). La cabecera con marca y selector de
 * idioma es la misma que la de `LandingHeader` sin el enlace «Entrar»
 * (aquí ya hay sesión): era la única pantalla del producto sin forma de
 * cambiar de idioma (M10), justo la que ve alguien que quizá entró por
 * error y puede no leer el idioma en que le ha tocado la interfaz. El enlace «Abrir la app» usa el esquema propio
 * `popyplan://`: si la app no está instalada, el navegador simplemente no
 * hace nada — por eso los botones de tienda van justo encima.
 */
export function AppAccountScreen() {
  const t = useTranslations("landing.appAccount");
  const tHeader = useTranslations("landing.header");

  return (
    <div className="flex min-h-screen flex-col bg-border-light">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
          <p className="text-base font-semibold text-text-base">{tHeader("brand")}</p>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-lg border border-border bg-white p-4">
          <h1 className="mb-2 text-xl font-semibold text-text-base">{t("title")}</h1>
          <p className="mb-4 text-sm text-text-secondary">{t("description")}</p>
          <div className="mb-4">
            <StoreLinks label={t("storesLabel")} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="popyplan://" className={PRIMARY_LINK_CLASS}>
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
