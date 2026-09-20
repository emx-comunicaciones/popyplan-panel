import Link from "next/link";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

import { SECONDARY_LINK_CLASS } from "./linkStyles";

/**
 * Cabecera de la web pública: marca, selector de idioma y «Entrar».
 *
 * La marca va en un `<p>`, no en un encabezado: el único `<h1>` de la
 * página es el titular de la portada (`Hero`), y un `<h1>` con la marca
 * dejaría dos primeros niveles compitiendo en el mismo documento.
 */
export function LandingHeader() {
  const t = useTranslations("landing.header");

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
        <p className="text-base font-semibold text-text-base">{t("brand")}</p>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/login" className={SECONDARY_LINK_CLASS}>
            {t("login")}
          </Link>
        </div>
      </div>
    </header>
  );
}
