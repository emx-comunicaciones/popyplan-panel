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
 * Los dos títulos de columna son `h2` (M4 de la revisión de rama), no
 * `<p>` en negrita: dan navegación por encabezados y no rompen el orden
 * (el último encabezado antes del pie es el `h2` del banner de descarga).
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

  // `focus-visible:outline-text-inverse` (I1 de la revisión de rama): el
  // anillo de foco global de `app/globals.css` es `--color-primary-700`,
  // que aquí es **exactamente** el color de fondo del pie — 1,00:1, es
  // decir, ningún indicador de foco al tabular por los once enlaces
  // (WCAG 2.4.7). En blanco sobre `primary-700` son 5,03:1, par ya
  // auditado. Misma clase de regresión que `CLAUDE.md` documenta para el
  // botón «?» de `PageHelp`: la regla de contraste del repo está tabulada
  // contra blanco y se invierte sobre una superficie de marca.
  const linkClass =
    "text-[17px] text-text-inverse underline-offset-4 hover:underline focus-visible:outline-text-inverse";
  const smallLinkClass =
    "text-[14px] text-text-inverse underline-offset-4 hover:underline focus-visible:outline-text-inverse";

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
                <h2 className="font-display text-[18px] font-bold">{t("product")}</h2>
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
                <h2 className="font-display text-[18px] font-bold">{t("downloads")}</h2>
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

          {/*
            Tarjeta **blanca entera** con texto oscuro (I3 de la revisión
            de rama). El `bg-white/10` que tenía antes se componía sobre
            `primary-700` y dejaba el texto blanco en 4,20:1, por debajo de
            AA para 16-18 px; `text-base` sobre blanco son 19,8:1, el par
            mejor auditado del panel. `lib/a11y/tokens.test.ts` no podía
            avisar: audita tokens, no colores compuestos con canal alfa.
          */}
          <div className="flex w-full items-center gap-4 self-start rounded-2xl bg-white px-5 py-4 text-text-base sm:w-auto sm:px-6">
            <Image
              src="/landing/qr-download.svg"
              alt={t("qrAlt")}
              width={160}
              height={160}
              unoptimized
              className="size-[120px] shrink-0 sm:size-[160px]"
            />
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
