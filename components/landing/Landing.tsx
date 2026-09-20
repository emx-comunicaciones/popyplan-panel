import { Footer } from "@/components/layout/Footer";

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
 */
export function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-border-light">
      <LandingHeader />
      <main className="flex-1">
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
