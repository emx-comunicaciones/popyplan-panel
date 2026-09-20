import { SkipLink } from "@/components/ui/SkipLink";

import { DownloadBanner } from "./DownloadBanner";
import { Features } from "./Features";
import { LANDING_FONT_CLASS } from "./fonts";
import { Hero } from "./Hero";
import { LandingFooter } from "./LandingFooter";
import { LandingHeader } from "./LandingHeader";
import { ModeToggle } from "./ModeToggle";
import { Values } from "./Values";

/**
 * Web pública de presentación, rediseño «planes sanos, gente activa»
 * (2026-09-20, brief en
 * `.superpowers/sdd/2026-09-20-landing-deportiva/brief.md`): una sola
 * página por bloques, en este orden, con el lenguaje visual de la web de
 * referencia y el discurso de deporte, naturaleza y bienestar — sin
 * ninguna mención a asociaciones, administraciones, profesionales ni
 * adicciones, que es lo que pidió el propietario.
 *
 * Orden de encabezados: `h1` (portada) → `h2` (titular del conmutador,
 * «Funcionalidades», «Lo que nos diferencia», banner de descarga) →
 * `h3` (cada funcionalidad y cada valor), sin saltos — `axe` lo
 * comprueba en `app/page.test.tsx`.
 *
 * `<SkipLink />` + `<main id="main-content" tabIndex={-1}>`, mismo
 * patrón que los tres layouts de área.
 *
 * `LANDING_FONT_CLASS` (Plus Jakarta Sans + DM Sans) se aplica **solo
 * aquí y en `AppAccountScreen`**: el resto del panel sigue con Geist.
 * `overflow-x-clip` acota los elementos decorativos que sobresalen (las
 * burbujas y los blobs van a propósito fuera del contenedor) para que
 * ninguna pantalla estrecha acabe con scroll horizontal.
 */
export function Landing() {
  return (
    <div
      className={`${LANDING_FONT_CLASS} relative flex min-h-screen flex-col overflow-x-clip bg-white text-text-base`}
    >
      <SkipLink />
      <LandingHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <Hero />
        <ModeToggle />
        <Features />
        <Values />
        <DownloadBanner />
      </main>
      <LandingFooter />
    </div>
  );
}
