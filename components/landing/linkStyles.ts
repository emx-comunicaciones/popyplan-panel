/**
 * Enlaces con aspecto de botón de la web pública. Son `<a>`, no
 * `components/ui/Button.tsx` (que renderiza un `<button>`): una llamada
 * que navega tiene que ser un enlace de verdad — con su menú contextual,
 * su «abrir en pestaña nueva» y su anuncio como enlace en un lector de
 * pantalla.
 *
 * Mismas medidas que `Button` tras la pasada de densidad (2026-09-20):
 * 32px de alto mínimo (`min-h-8`, el objetivo interactivo mínimo del
 * panel), 12px de relleno horizontal y texto de 13px (`text-sm`). Sin
 * sombra. El color de texto y de fondo sale de `primary-700`, nunca de
 * `primary` a secas (regla de contraste de `CLAUDE.md`: `primary` solo
 * para superficies decorativas sin texto).
 */
const BASE =
  "inline-flex min-h-8 items-center justify-center gap-2 rounded-md px-3 py-1 text-sm font-medium transition-colors";

export const PRIMARY_LINK_CLASS = `${BASE} bg-primary-700 text-text-inverse hover:bg-secondary-600`;

export const SECONDARY_LINK_CLASS = `${BASE} border border-border bg-white text-text-form hover:bg-border-light`;
