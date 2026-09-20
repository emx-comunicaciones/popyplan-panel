/**
 * Escala del mapa de burbujas de Territorio (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §4.2). Funciones
 * puras, sin React y sin `leaflet`: el componente
 * `components/metrics/TerritoryMap.tsx` solo pinta lo que sale de aquí,
 * así que toda la aritmética es probable sin montar un mapa.
 *
 * **Desviación documentada de la spec.** §4.2 pide «tamaño =
 * actividades, color = tasa de asistencia», pero el componente recibe
 * las filas de `by_place`, y `ByPlaceRow` (`docs/PANEL.md` §1.4) es
 * `{key, label, events, people, suppressed}`: **no lleva tasa de
 * asistencia por fila** — limitación del esquema fijo ya documentada en
 * `CLAUDE.md` («Desviación conocida» de la tarea W2), no un olvido de
 * esta tarea. Aquí el **tamaño** codifica `events` y el **color**
 * codifica `people` (la métrica suprimible), con gris para lo suprimido,
 * que es la lectura que los datos disponibles permiten sin una petición
 * extra por municipio. Si algún día `by_place` trae una tasa por fila,
 * `bubbleColor` es el único sitio que hay que cambiar.
 *
 * El color sale de tokens decorativos (`--color-primary*`), no de los
 * tonos de texto: son rellenos sin texto encima, que es justo la
 * excepción que `CLAUDE.md` reserva para `--color-primary` (todo texto
 * usa `--color-primary-700`). El gris de supresión es
 * `--color-text-disabled`, el único gris medio de la paleta.
 */
import type { ByPlaceRow, PlaceRow } from "@/lib/api/types";

export const MIN_RADIUS = 6;
export const MAX_RADIUS = 28;

/**
 * **Literales hex, nunca `var(--…)`** (hallazgo crítico C1 de la
 * revisión final de rama). `pathOptions.color`/`fillColor` acaban en
 * `L.Path::_updateStyle`, que Leaflet 1.9.4 escribe con
 * `path.setAttribute('stroke', …)`/`setAttribute('fill', …)`
 * (`node_modules/leaflet/dist/leaflet-src.js`) — un **atributo de
 * presentación** SVG, no una declaración CSS. Ningún navegador resuelve
 * una propiedad personalizada dentro de un atributo de presentación
 * (solo dentro de `style="…"` o una hoja de estilos), así que
 * `"var(--color-primary)"` ahí es un valor inválido que el navegador
 * ignora: las burbujas se quedan con el `fill` por omisión de SVG
 * (negro) y sin la rampa de marca ni el gris de supresión. Se copian a
 * mano los valores actuales de `app/globals.css`;
 * `lib/metrics/mapScale.test.ts` lee ese fichero de verdad y falla si
 * la paleta cambia sin actualizar también estos literales (mismo patrón
 * que `lib/a11y/tokens.test.ts`).
 */
export const SUPPRESSED_COLOR = "#bdbdbd"; // --color-text-disabled

/**
 * Rampa de tres tonos de la marca, de menos a más personas. Tres y no
 * más: el mapa es una lectura de un vistazo y la tabla de debajo tiene
 * la cifra exacta.
 */
const PEOPLE_COLORS = [
  "#d7f3f1", // --color-primary-100
  "#1fb3ae", // --color-primary
  "#0e7c78", // --color-primary-700
] as const;

export interface MapBubble {
  ineCode: string;
  label: string;
  latitude: number;
  longitude: number;
  radius: number;
  color: string;
  events: number;
  people: number | null;
  suppressed: boolean;
}

/**
 * Número finito o `null`. `PlaceRow.latitude`/`longitude` se declaran
 * `number | null` siguiendo el ejemplo de la spec §3.2, pero un
 * `DecimalField` de DRF puede llegar serializado como cadena según la
 * configuración del backend: una coordenada que no sea un número finito
 * no puede pintar una burbuja, y `L.CircleMarker` con `NaN` lanza.
 */
export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Radio en píxeles. El área del círculo (∝ radio²) es lo que el ojo lee
 * como «cantidad», así que el radio crece con la raíz cuadrada de la
 * proporción de actividades — si no, un municipio con el doble de
 * actividades parecería tener cuatro veces más.
 */
export function bubbleRadius(events: number, maxEvents: number): number {
  if (!Number.isFinite(events) || events <= 0) return MIN_RADIUS;
  const safeMax = Number.isFinite(maxEvents) && maxEvents > 0 ? maxEvents : events;
  const ratio = Math.sqrt(Math.min(events, safeMax) / safeMax);
  return MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
}

/**
 * Color de relleno. Un `people` nulo es gris **siempre**, esté marcado
 * `suppressed` o no: en los dos casos no hay cifra que representar, y
 * pintar el tono más claro de la rampa se leería como «casi nadie».
 */
export function bubbleColor(people: number | null, suppressed: boolean, maxPeople: number): string {
  if (people === null || suppressed) return SUPPRESSED_COLOR;
  const safeMax = Number.isFinite(maxPeople) && maxPeople > 0 ? maxPeople : people;
  if (safeMax <= 0) return PEOPLE_COLORS[0];
  const ratio = Math.min(people, safeMax) / safeMax;
  if (ratio >= 1) return PEOPLE_COLORS[2];
  if (ratio > 1 / 3) return PEOPLE_COLORS[1];
  return PEOPLE_COLORS[0];
}

/**
 * Une las filas de `by_place` (`key` = código INE) con las coordenadas
 * del catálogo de municipios y devuelve una burbuja por fila **que tenga
 * coordenadas**: una fila sin municipio en el catálogo, o con la
 * coordenada vacía, se descarta en silencio — el dato sigue estando
 * entero en la tabla de debajo, que es la alternativa completa al mapa.
 */
export function toBubbles(rows: ByPlaceRow[], places: PlaceRow[]): MapBubble[] {
  const byIne = new Map(places.map((place) => [place.ine_code, place]));
  const maxEvents = rows.reduce((max, row) => Math.max(max, row.events), 0);
  const maxPeople = rows.reduce((max, row) => Math.max(max, row.people ?? 0), 0);

  const bubbles: MapBubble[] = [];
  for (const row of rows) {
    const place = byIne.get(row.key);
    if (!place) continue;
    const latitude = toFiniteNumber(place.latitude);
    const longitude = toFiniteNumber(place.longitude);
    if (latitude === null || longitude === null) continue;

    bubbles.push({
      ineCode: row.key,
      label: row.label,
      latitude,
      longitude,
      radius: bubbleRadius(row.events, maxEvents),
      color: bubbleColor(row.people, row.suppressed, maxPeople),
      events: row.events,
      people: row.people,
      suppressed: row.suppressed,
    });
  }
  return bubbles;
}
