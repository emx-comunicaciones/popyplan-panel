import { Footer } from "@/components/layout/Footer";
import { SkipLink } from "@/components/ui/SkipLink";

import { Audiences } from "./Audiences";
import { Contact } from "./Contact";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { LandingHeader } from "./LandingHeader";
import { Privacy } from "./Privacy";

/**
 * Web pública de presentación (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §3.3 y §4): una sola página
 * por bloques, en este orden. Sin botón «?» de ayuda: está fuera de las
 * tres áreas del panel (decisión 3 de «ayuda por pantalla»).
 *
 * Orden de encabezados: `h1` (portada) → `h2` (sección) → `h3` (tarjeta
 * de público), sin saltos — `axe` lo comprueba en `app/page.test.tsx`.
 *
 * `<SkipLink />` + `<main id="main-content" tabIndex={-1}>`, mismo patrón
 * que los tres layouts de área (`app/{entidad,paraguas,plataforma}/[slug]/
 * layout.tsx`): la landing es la única pantalla pública con navegación por
 * teclado sustancial (cabecera + cinco secciones + pie), así que también
 * necesita un salto directo al contenido.
 */
export function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-border-light">
      <SkipLink />
      <LandingHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <Hero />
        <Audiences />
        <HowItWorks />
        <Privacy />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
