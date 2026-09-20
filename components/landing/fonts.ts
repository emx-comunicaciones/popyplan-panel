import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Tipografías de la web pública (rediseño «planes sanos, gente activa»,
 * 2026-09-20): **Plus Jakarta Sans** para los titulares y **DM Sans**
 * para el cuerpo, las mismas que la web de referencia
 * (`.superpowers/sdd/2026-09-20-landing-deportiva/site-circle.html`).
 *
 * **Solo para la landing y para `AppAccountScreen`**, nunca para el
 * panel: las dos se declaran aquí con `variable`, y el contenedor raíz
 * de esas dos pantallas es el único sitio que aplica
 * `LANDING_FONT_CLASS`. Fuera de ese subárbol, `--font-plus-jakarta-sans`
 * y `--font-dm-sans` no existen, así que `font-display`/`font-body`
 * (definidas en `app/globals.css` dentro de `@theme inline`, que resuelve
 * la variable en el sitio de uso) no pintan nada distinto — el resto del
 * panel sigue con Geist, como antes.
 *
 * `display: "swap"`: el texto se pinta de inmediato con la fuente de
 * respaldo y se sustituye al cargar la tipografía, en vez de dejar la
 * portada en blanco mientras llega el fichero.
 */
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

/**
 * Clase del contenedor raíz de la web pública: declara las dos variables
 * de fuente y fija DM Sans como fuente base del subárbol (los titulares
 * piden `font-display` explícitamente).
 */
export const LANDING_FONT_CLASS = `${display.variable} ${body.variable} font-body`;
