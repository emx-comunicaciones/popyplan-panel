import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";

/**
 * Auditoría automática de contraste de los tokens de color reales de
 * `app/globals.css` (tarea W1, Fase 6). Sustituye la comprobación «a
 * mano» documentada hasta ahora en `CLAUDE.md` («Accesibilidad») por un
 * test que falla si algún par texto/fondo baja de su umbral AA, para
 * que un cambio futuro de paleta no reintroduzca en silencio los dos
 * pares que fallaban antes de esta tarea.
 *
 * Extrae los tokens directamente del `:root` de `app/globals.css` (no
 * los reimporta a mano aquí) para que el test audite el fichero real,
 * no una copia que pueda desincronizarse de él.
 */

const GLOBALS_CSS = path.resolve(__dirname, "..", "..", "app", "globals.css");

function parseTokens(source: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  // Solo el primer bloque `:root { ... }` (los valores en crudo; el
  // segundo bloque, `@theme inline`, solo los reexpone a Tailwind).
  const rootMatch = source.match(/:root\s*\{([^}]*)\}/);
  if (!rootMatch) {
    throw new Error("No se encontró un bloque :root en app/globals.css");
  }
  const body = rootMatch[1];
  const declarationPattern = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g;
  let match: RegExpExecArray | null;
  while ((match = declarationPattern.exec(body))) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

const css = fs.readFileSync(GLOBALS_CSS, "utf-8");
const tokens = parseTokens(css);

function token(name: string): string {
  const value = tokens[name];
  if (!value) {
    throw new Error(`Token --${name} no encontrado en app/globals.css`);
  }
  return value;
}

describe("contraste de los tokens de color (app/globals.css)", () => {
  // Umbral 4.5:1 (texto normal, AA) salvo donde se indica lo contrario.
  const pairs: Array<[string, string, string, number]> = [
    ["text-base / background", "color-text-base", "color-background", 4.5],
    ["text-secondary / background", "color-text-secondary", "color-background", 4.5],
    ["text-form / background (etiquetas)", "color-text-form", "color-background", 4.5],
    ["error / background (texto de error)", "color-error", "color-background", 4.5],
    ["success / background (texto de éxito)", "color-success", "color-background", 4.5],
    [
      "text-inverse / secondary-900 (cabecera de plataforma)",
      "color-text-inverse",
      "color-secondary-900",
      4.5,
    ],
    ["text-base / border-light (fondo de página)", "color-text-base", "color-border-light", 4.5],
    [
      "text-inverse / primary-700 (botón primario, cabecera de entidad)",
      "color-text-inverse",
      "color-primary-700",
      4.5,
    ],
    [
      "primary-700 / background (enlaces, texto en text-primary-700)",
      "color-primary-700",
      "color-background",
      4.5,
    ],
    ["text-base / primary-100 (tinte claro de cabecera)", "color-text-base", "color-primary-100", 4.5],
    // Banner de descarga de la web pública: texto blanco **grande**
    // (≥ 24 px, umbral AA de 3:1) sobre el extremo claro del degradado
    // turquesa. El extremo oscuro es `primary-700`, ya auditado arriba a
    // 4,5:1, así que con estos dos el degradado entero es legible.
    [
      "text-inverse / primary-600 (banner de descarga, texto grande)",
      "color-text-inverse",
      "color-primary-600",
      3,
    ],
    ["text-base / primary (tarjetas decorativas sobre el tono de marca)", "color-text-base", "color-primary", 4.5],
  ];

  it.each(pairs)("%s ≥ %s:1", (_label, fg, bg, threshold) => {
    const ratio = contrastRatio(token(fg), token(bg));
    expect(ratio).toBeGreaterThanOrEqual(threshold);
  });

  it("el token --color-text-form-secondary (sin uso) ya no existe", () => {
    expect(tokens["color-text-form-secondary"]).toBeUndefined();
  });

  it("--color-primary (decorativo) sigue existiendo para gráficos y fondos sin texto", () => {
    expect(token("color-primary")).toBe("#1fb3ae");
  });
});
