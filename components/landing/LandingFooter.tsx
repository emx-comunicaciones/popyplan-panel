import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { legalLinks, storeLinks } from "@/lib/config/site";

/**
 * Pie de la web pública (rediseño 2026-09-20, bloque 7 del brief):
 * logo blanco, columnas «Producto» y «Descargas», tarjeta con el código
 * QR y la línea inferior con el aviso de derechos, los enlaces legales,
 * la declaración de accesibilidad y el acceso al panel.
 *
 * **Fondo `--color-primary-700`, no `--color-primary`**: la referencia
 * usa el turquesa de marca con texto blanco encima, que da 2,59:1 y no
 * llega a AA ni para texto grande. `primary-700` mantiene el mismo
 * aspecto turquesa oscuro y da 5,03:1 (par ya auditado en
 * `lib/a11y/tokens.test.ts`). Por el mismo motivo **ningún texto de este
 * pie usa blanco translúcido** (`text-white/70` sobre este fondo baja a
 * ≈3,3:1): todo va en blanco pleno, y los enlaces se distinguen al pasar
 * por encima con subrayado, no solo con un cambio de opacidad.
 *
 * Este pie **sustituye** a `components/layout/Footer.tsx` en la landing
 * (el del panel solo lleva el enlace de accesibilidad): aquí ese enlace
 * está en la línea inferior, junto al resto, que es lo que exige el
 * RD 1112/2018 — localizable desde la página pública.
 *
 * Los cuatro enlaces legales son URLs absolutas de `popyplan.com`
 * (`legalLinks()`), páginas que este panel no sirve: van con
 * `target="_blank"` + `rel="noopener noreferrer"`, igual que las fichas
 * de tienda. «Accesibilidad» y «Acceso al panel» sí son rutas propias,
 * con `next/link`.
 *
 * El QR es una imagen, no un enlace: quien ve la pantalla lo escanea con
 * el móvil, y quien no la ve ya tiene las dos fichas de tienda enlazadas
 * en la columna «Descargas» y en el banner de arriba.
 */
export function LandingFooter() {
  const t = useTranslations("landing.footer");
  const tHeader = useTranslations("landing.header");
  const legal = legalLinks();
  const { appStore, playStore } = storeLinks();
  // Cadena, no número: un `{year}` numérico lo formatearía `Intl` con
  // separador de millares y el pie diría «© 2.026».
  const year = String(new Date().getFullYear());

  const linkClass = "text-[17px] text-text-inverse underline-offset-4 hover:underline";
  const smallLinkClass = "text-[14px] text-text-inverse underline-offset-4 hover:underline";

  return (
    <footer className="bg-primary-700 text-text-inverse">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-14 lg:px-12 lg:py-20">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-10 sm:flex-row sm:gap-16 lg:gap-24">
            <Image
              src="/landing/logo-white.svg"
              alt={t("logoAlt")}
              width={133}
              height={88}
              unoptimized
              className="h-[72px] w-auto object-contain lg:h-[88px]"
            />
            <nav aria-label={t("navLabel")} className="flex gap-12 sm:gap-20">
              <div className="flex flex-col gap-5">
                <p className="font-display text-[18px] font-bold">{t("product")}</p>
                <ul className="flex flex-col gap-4">
                  <li>
                    <a href="#inicio" className={linkClass}>
                      {tHeader("home")}
                    </a>
                  </li>
                  <li>
                    <a href="#funcionalidades" className={linkClass}>
                      {tHeader("features")}
                    </a>
                  </li>
                  <li>
                    <a href="#descarga" className={linkClass}>
                      {tHeader("downloadNav")}
                    </a>
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-5">
                <p className="font-display text-[18px] font-bold">{t("downloads")}</p>
                <ul className="flex flex-col gap-4">
                  {appStore ? (
                    <li>
                      <a
                        href={appStore}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        {t("ios")}
                      </a>
                    </li>
                  ) : null}
                  {playStore ? (
                    <li>
                      <a
                        href={playStore}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        {t("android")}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            </nav>
          </div>

          <div className="flex w-full items-center gap-4 self-start rounded-2xl bg-white/10 px-5 py-4 sm:w-auto sm:px-6">
            <span className="size-[120px] shrink-0 rounded-2xl bg-white p-2 sm:size-[160px]">
              <Image
                src="/landing/qr-download.svg"
                alt={t("qrAlt")}
                width={160}
                height={160}
                unoptimized
                className="h-full w-full"
              />
            </span>
            <p className="flex-1 text-right font-display text-[16px] font-bold leading-tight sm:w-[180px] sm:flex-none sm:text-[18px]">
              {t("qrText")}
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/30 pt-6 text-[14px] sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year })}</p>
          <div className="flex flex-wrap gap-4">
            <a
              href={legal.support}
              target="_blank"
              rel="noopener noreferrer"
              className={smallLinkClass}
            >
              {t("support")}
            </a>
            <a
              href={legal.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className={smallLinkClass}
            >
              {t("privacy")}
            </a>
            <a
              href={legal.terms}
              target="_blank"
              rel="noopener noreferrer"
              className={smallLinkClass}
            >
              {t("terms")}
            </a>
            <a
              href={legal.deleteAccount}
              target="_blank"
              rel="noopener noreferrer"
              className={smallLinkClass}
            >
              {t("deleteAccount")}
            </a>
            <Link href="/accesibilidad" className={smallLinkClass}>
              {t("accessibility")}
            </Link>
            <Link href="/login" className={smallLinkClass}>
              {t("panel")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
