/**
 * Utilidades de contraste de color (tarea W1, Fase 6 — accesibilidad).
 * Implementa la fórmula de luminancia relativa y contraste de WCAG 2.1
 * (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance,
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio) sobre colores en
 * formato hexadecimal `#RRGGBB`. Se usa para:
 *
 * - `lib/a11y/tokens.test.ts`: auditar a mano los pares texto/fondo de
 *   `app/globals.css` (test automático, sustituye la comprobación
 *   manual documentada en `CLAUDE.md`).
 * - Las cabeceras de `/entidad/[slug]` y `/paraguas/[slug]`: calculan
 *   el color de texto legible sobre el color de marca de la entidad
 *   (`org.primary_color`, dato de terceros, no controlado por esta
 *   app) con `readableOn`.
 */

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Componentes 0..1 de un color hexadecimal, o `null` si la cadena no es
 * un hex reconocible. Admite `#RGB`, `#RRGGBB` y `#RRGGBBAA`, con o sin
 * almohadilla y en cualquier caja; el canal alfa se ignora (el contraste
 * de WCAG se define entre dos colores opacos, y aquí no se conoce lo que
 * hay detrás). Devolver `null` en vez de `NaN` es lo que permite a quien
 * llama distinguir «no calculable» de un ratio real: `primary_color` es
 * un dato de la entidad, no de esta app, y puede llegar vacío o con un
 * nombre CSS — antes eso daba `NaN`, toda comparación con `NaN` es
 * `false` y la cabecera se pintaba con un fondo ilegible en vez de caer
 * al tinte.
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const match = HEX_RE.exec(hex.trim());
  if (!match) return null;
  const digits = match[1];
  const clean =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => `${digit}${digit}`)
          .join("")
      : digits;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function channelLuminance(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/**
 * WCAG 2.1: luminancia relativa de un color hex, de 0 (negro) a 1
 * (blanco); `null` si el color no es un hex reconocible (ver `hexToRgb`).
 */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/**
 * WCAG 2.1: ratio de contraste entre dos colores hex, de 1 (igual) a 21
 * (blanco/negro); `null` si alguno de los dos no es un hex reconocible.
 */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Color de texto legible sobre un fondo dado: el que dé más ratio entre
 * blanco y el tono oscuro de la app (`--color-secondary-900`). Con las
 * dos únicas opciones que soporta hoy la app, siempre hay una que llega
 * a 3:1 (el mínimo entre ambos ratios posibles es ~3,8:1, por la
 * luminancia muy baja de `--color-secondary-900`). Devuelve `null` si el
 * fondo no es un hex reconocible: no hay texto que se pueda garantizar
 * legible sobre un color que no se sabe cuál es, y quien llama
 * (`app/{entidad,paraguas}/[slug]/layout.tsx`) cae entonces al tinte
 * claro de cabecera, igual que cuando el par no llega a 3:1.
 */
export function readableOn(background: string): "#FFFFFF" | "#1A2C33" | null {
  const ratioWhite = contrastRatio("#FFFFFF", background);
  const ratioDark = contrastRatio("#1A2C33", background);
  if (ratioWhite === null || ratioDark === null) return null;
  return ratioWhite >= ratioDark ? "#FFFFFF" : "#1A2C33";
}

/** AA: 4.5:1 para texto normal, 3:1 para texto grande (≥24px o ≥19px negrita) o UI no textual. */
export function meetsAA(fg: string, bg: string, large = false): boolean {
  const threshold = large ? 3 : 4.5;
  const ratio = contrastRatio(fg, bg);
  // Un color no calculable no cumple AA: no hay nada que demostrar.
  return ratio !== null && ratio >= threshold;
}
