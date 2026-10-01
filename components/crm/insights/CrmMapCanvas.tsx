"use client";

/**
 * La parte `react-leaflet` del mapa comercial, en su propio fichero porque
 * `CrmMapView` la carga con `next/dynamic({ssr:false})` (leaflet toca
 * `window` al importarse). Sin control de atribución propio: el aviso de
 * OpenStreetMap lo pinta la vista como enlace normal.
 */
import { divIcon, type DivIcon } from "leaflet";
import type { ReactNode } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import type { CrmMapPoint } from "@/lib/api/crmTypes";

import { MAP_STATUSES, glyphSvg, mapStatus, type MapStatus } from "./mapStatus";

import "leaflet/dist/leaflet.css";

const OSM_ATTRIBUTION_HTML =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const SPAIN_CENTER: [number, number] = [40.2, -3.7];
const MARKER_SIZE = 28;

let icons: Record<MapStatus, DivIcon> | null = null;

function iconFor(status: MapStatus): DivIcon {
  if (!icons) {
    icons = Object.fromEntries(
      MAP_STATUSES.map((s) => [
        s,
        divIcon({
          html: glyphSvg(s, MARKER_SIZE),
          className: "",
          iconSize: [MARKER_SIZE, MARKER_SIZE],
          iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
          popupAnchor: [0, -MARKER_SIZE / 2],
        }),
      ]),
    ) as Record<MapStatus, DivIcon>;
  }
  return icons[status];
}

export interface CrmMapCanvasProps {
  points: CrmMapPoint[];
  renderPopup: (point: CrmMapPoint) => ReactNode;
}

export function CrmMapCanvas({ points, renderPopup }: CrmMapCanvasProps) {
  return (
    <MapContainer
      center={SPAIN_CENTER}
      zoom={6}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={OSM_ATTRIBUTION_HTML} />
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[Number(point.latitude), Number(point.longitude)]}
          icon={iconFor(mapStatus(point))}
          title={point.name}
        >
          <Popup minWidth={220}>{renderPopup(point)}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
