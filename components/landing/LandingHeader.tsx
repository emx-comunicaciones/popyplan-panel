import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

import { DARK_BUTTON_CLASS, NAV_LINK_CLASS, QUIET_LINK_CLASS } from "./linkStyles";

/**
 * Cabecera de la web pública (rediseño 2026-09-20): logo, anclas de
 * sección, botón negro «Descarga la app», selector de idioma y el enlace
 * discreto «Entrar» al login único del panel.
 *
 * La marca es el logo con `alt="Popyplan"` dentro de un enlace al ancla
 * de portada: el único `<h1>` de la página es el titular de `Hero`, y un
 * encabezado con la marca dejaría dos primeros niveles compitiendo.
 *
 * Las tres anclas se ocultan por debajo de `md`: en móvil la cabecera
 * deja solo lo que hay que poder hacer desde arriba (descargar, cambiar
 * de idioma, entrar al panel) y el contenido de las secciones sigue
 * estando a un scroll de distancia. Sin menú hamburguesa, que sería un
 * patrón nuevo (con su foco atrapado y su estado) para tres enlaces que
 * llevan a la misma página.
 */
export function LandingHeader() {
  const t = useTranslations("landing.header");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-3 lg:px-12">
        <Link href="#inicio" className="flex shrink-0 items-center">
          <Image
            src="/landing/logo.svg"
            alt={t("logoAlt")}
            width={79}
            height={52}
            unoptimized
            priority
            className="h-10 w-auto sm:h-12"
          />
        </Link>

        <nav aria-label={t("navLabel")} className="hidden items-center gap-8 md:flex">
          <a href="#inicio" className={NAV_LINK_CLASS}>
            {t("home")}
          </a>
          <a href="#funcionalidades" className={NAV_LINK_CLASS}>
            {t("features")}
          </a>
          <a href="#descarga" className={NAV_LINK_CLASS}>
            {t("downloadNav")}
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/*
            `aria-label` fija el nombre accesible aunque el texto se
            oculte por debajo de `sm` (ahí la cabecera solo tiene sitio
            para el icono): sin él, el botón se anunciaría como un enlace
            sin nombre en móvil.
          */}
          <a href="#descarga" aria-label={t("download")} className={DARK_BUTTON_CLASS}>
            <Image src="/landing/ic-download.svg" alt="" width={20} height={20} unoptimized />
            <span className="hidden sm:inline">{t("download")}</span>
          </a>
          <LanguageSwitcher />
          <Link href="/login" className={QUIET_LINK_CLASS}>
            {t("login")}
          </Link>
        </div>
      </div>
    </header>
  );
}
