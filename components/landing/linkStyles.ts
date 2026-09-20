/**
 * Enlaces con aspecto de botón de la web pública. Son `<a>`, no
 * `components/ui/Button.tsx` (que renderiza un `<button>`): una llamada
 * que navega tiene que ser un enlace de verdad — con su menú contextual,
 * su «abrir en pestaña nueva» y su anuncio como enlace en un lector de
 * pantalla.
 *
 * **Medidas propias de la landing, no las del panel** (rediseño
 * 2026-09-20): la pasada de densidad dejó los controles del panel en
 * 32 px y el texto de trabajo en 13 px, que es lo correcto para una
 * herramienta de uso diario y demasiado pequeño para una página de
 * presentación. Aquí los tamaños van en píxeles explícitos —y no con las
 * clases `text-sm`/`text-base`, que en este repo están remapeadas hacia
 * abajo (ver `app/globals.css`)— para que la web pública no herede esa
 * escala ni cambie si el panel vuelve a ajustarla.
 *
 * El botón principal es **negro** (`--color-text-base`, `#0b0a0a`), como
 * en la web de referencia: blanco sobre negro da 19,8:1, el par mejor
 * auditado de `lib/a11y/tokens.test.ts`. El `hover` usa
 * `--color-secondary-900` (14,46:1 con blanco, también auditado) en vez
 * de un negro aclarado a ojo.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[16px] font-medium transition-colors";

/** Llamada principal: fondo negro, texto blanco (cabecera, «Abrir la app»). */
export const DARK_BUTTON_CLASS = `${BASE} bg-text-base text-text-inverse hover:bg-secondary-900`;

/** Enlace de texto discreto sobre fondo claro («Entrar»). */
export const QUIET_LINK_CLASS =
  "inline-flex items-center rounded-md px-2 py-1 text-[16px] font-medium text-text-base underline-offset-4 transition-colors hover:text-primary-700 hover:underline";

/** Enlace de navegación de la cabecera (anclas de sección). */
export const NAV_LINK_CLASS =
  "text-[16px] font-medium text-text-base transition-colors hover:text-primary-700";
