"use client";

/**
 * La parte `react-leaflet` del mapa de Territorio, en su propio fichero
 * porque `components/metrics/TerritoryMap.tsx` la carga con
 * `next/dynamic({ssr:false})`: `leaflet` toca `window` al importarse, así
 * que no puede formar parte del bundle del servidor ni del resto del
 * panel (riesgo R2 de la spec, «peso del mapa en el bundle»).
 *
 * Teselas de OpenStreetMap, sin clave de API (spec §4.2). `zoomControl`,
 * `keyboard` **y `attributionControl`** van desactivados **a propósito**:
 * el contenedor de `TerritoryMap` es `role="img"`, y tanto los controles
 * de zoom como el control de atribución por defecto de Leaflet son
 * `<a href>` enfocables — un elemento enfocable dentro de un rol no
 * interactivo es una trampa de teclado sin salida útil (fix round 1,
 * revisión del coordinador: `attributionControl` se quedó en su valor
 * por defecto `true` en la primera versión de esta tarea, así que
 * montaba igualmente el enlace `https://leafletjs.com` de Leaflet dentro
 * del `role="img"`). El zoom con rueda sigue disponible para quien use
 * ratón, y toda la información y toda la acción del mapa están
 * duplicadas en la tabla de debajo. La atribución real y visible de
 * OpenStreetMap —obligatoria por su política de uso de teselas— la pinta
 * `TerritoryMap.tsx` como un párrafo con un enlace de verdad **fuera**
 * del `role="img"`, no aquí.
 *
 * `OSM_ATTRIBUTION_HTML` sigue pasándose a `TileLayer` sin traducir
 * (nunca se pinta en pantalla: sin `attributionControl`, Leaflet no crea
 * ningún control que la lea) solo por si algún día se reactivara ese
 * control — es el texto que el propio Leaflet recomienda por defecto
 * para las teselas de OSM, no el que ve la persona usuaria.
 */
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

import type { MapBubble } from "@/lib/metrics/mapScale";

import "leaflet/dist/leaflet.css";

const OSM_ATTRIBUTION_HTML =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export interface TerritoryMapCanvasProps {
  bubbles: MapBubble[];
  /** Texto ya formateado por burbuja, indexado por código INE. */
  labels: Record<string, string>;
  onSelect: (ineCode: string) => void;
}

/** Centro y zoom iniciales: el centroide medio de las burbujas. */
function center(bubbles: MapBubble[]): [number, number] {
  const total = bubbles.length;
  const sum = bubbles.reduce(
    (acc, bubble) => [acc[0] + bubble.latitude, acc[1] + bubble.longitude] as [number, number],
    [0, 0] as [number, number],
  );
  return [sum[0] / total, sum[1] / total];
}

export function TerritoryMapCanvas({ bubbles, labels, onSelect }: TerritoryMapCanvasProps) {
  return (
    <MapContainer
      center={center(bubbles)}
      zoom={9}
      zoomControl={false}
      keyboard={false}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={OSM_ATTRIBUTION_HTML}
      />
      {bubbles.map((bubble) => (
        <CircleMarker
          key={bubble.ineCode}
          center={[bubble.latitude, bubble.longitude]}
          radius={bubble.radius}
          pathOptions={{ color: bubble.color, fillColor: bubble.color, fillOpacity: 0.7 }}
          eventHandlers={{ click: () => onSelect(bubble.ineCode) }}
        >
          <Tooltip>{labels[bubble.ineCode]}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
