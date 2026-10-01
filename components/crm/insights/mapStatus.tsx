/**
 * Estados del mapa comercial y su símbolo: cada uno se distingue por la
 * FORMA y por una letra (nunca solo por color). Colores como literales hex
 * a propósito: Leaflet los escribe como atributos SVG (ver `CLAUDE.md`).
 */
import { createElement } from "react";

import type { CrmMapPoint } from "@/lib/api/crmTypes";

export const MAP_STATUSES = ["sin_contactar", "contactado", "interesado", "negociacion", "cliente", "perdido"] as const;
export type MapStatus = (typeof MAP_STATUSES)[number];

const NEGOTIATION = ["negociacion", "contratacion"];
const INTERESTED = ["interesado", "propuesta_enviada", "demo_piloto", "reunion_realizada"];
const CONTACTED = ["contactado", "reunion_agendada"];

export function mapStatus(point: Pick<CrmMapPoint, "is_client" | "stage_kind" | "stage_key">): MapStatus {
  if (point.is_client || point.stage_kind === "won") return "cliente";
  if (point.stage_kind === "lost") return "perdido";
  const key = point.stage_key ?? "";
  if (NEGOTIATION.includes(key)) return "negociacion";
  if (INTERESTED.includes(key)) return "interesado";
  if (CONTACTED.includes(key)) return "contactado";
  if (key === "" || key === "sin_contactar") return "sin_contactar";
  // Fase abierta o en pausa que el mapa no conoce: ya hubo algún contacto.
  return "contactado";
}

type Shape = "circle" | "square" | "diamond" | "triangle" | "hexagon" | "pentagon";

interface Glyph {
  shape: Shape;
  fill: string;
  stroke: string;
  text: string;
  letter: string;
}

export const MAP_GLYPHS: Record<MapStatus, Glyph> = {
  sin_contactar: { shape: "circle", fill: "#FFFFFF", stroke: "#52606D", text: "#52606D", letter: "S" },
  contactado: { shape: "square", fill: "#72C9EE", stroke: "#0B5E86", text: "#102A43", letter: "C" },
  interesado: { shape: "diamond", fill: "#1FB3AE", stroke: "#0B6663", text: "#0B2E2D", letter: "I" },
  negociacion: { shape: "triangle", fill: "#E0A100", stroke: "#7A5800", text: "#1F1500", letter: "N" },
  cliente: { shape: "hexagon", fill: "#2E7D32", stroke: "#1B4D1E", text: "#FFFFFF", letter: "✓" },
  perdido: { shape: "pentagon", fill: "#B3261E", stroke: "#6E1712", text: "#FFFFFF", letter: "X" },
};

const SHAPE_ELEMENTS: Record<Shape, { tag: string; attrs: Record<string, string> }> = {
  circle: { tag: "circle", attrs: { cx: "12", cy: "12", r: "10" } },
  square: { tag: "rect", attrs: { x: "3", y: "3", width: "18", height: "18", rx: "2" } },
  diamond: { tag: "polygon", attrs: { points: "12,1 23,12 12,23 1,12" } },
  triangle: { tag: "polygon", attrs: { points: "12,2 23,22 1,22" } },
  hexagon: { tag: "polygon", attrs: { points: "7,2 17,2 23,12 17,22 7,22 1,12" } },
  pentagon: { tag: "polygon", attrs: { points: "12,1 23,9 19,22 5,22 1,9" } },
};

function letterY(status: MapStatus): number {
  return MAP_GLYPHS[status].shape === "triangle" ? 19 : 16;
}

/** El símbolo como cadena SVG, para `L.divIcon`. */
export function glyphSvg(status: MapStatus, size = 28): string {
  const glyph = MAP_GLYPHS[status];
  const { tag, attrs } = SHAPE_ELEMENTS[glyph.shape];
  const attrText = Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">` +
    `<${tag} ${attrText} fill="${glyph.fill}" stroke="${glyph.stroke}" stroke-width="2"/>` +
    `<text x="12" y="${letterY(status)}" text-anchor="middle" font-size="11" font-weight="700" ` +
    `font-family="sans-serif" fill="${glyph.text}">${glyph.letter}</text></svg>`
  );
}

/** El mismo símbolo como elemento React (leyenda y lista). Decorativo: el texto va al lado. */
export function MapGlyph({ status, size = 20 }: { status: MapStatus; size?: number }) {
  const glyph = MAP_GLYPHS[status];
  const { tag, attrs } = SHAPE_ELEMENTS[glyph.shape];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {createElement(tag, { ...attrs, fill: glyph.fill, stroke: glyph.stroke, strokeWidth: 2 })}
      <text x="12" y={letterY(status)} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="sans-serif" fill={glyph.text}>
        {glyph.letter}
      </text>
    </svg>
  );
}
