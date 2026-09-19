"use client";

/**
 * Mapa de burbujas del territorio (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §4.2): un círculo
 * por municipio sobre su centroide, con el tamaño y el color que decide
 * `lib/metrics/mapScale.ts` (y la desviación de «color = asistencia»
 * documentada en ese módulo).
 *
 * **Carga diferida** (`next/dynamic` con `ssr: false`, riesgo R2): todo
 * `leaflet` entra solo al visitar esta pantalla; el resto del panel no
 * lo paga. `TerritoryMapCanvas` está en un fichero aparte precisamente
 * para poder importarlo así.
 *
 * **Accesibilidad**: el contenedor es `role="img"` con un `aria-label`
 * que dice cuántos municipios hay, y nada dentro es enfocable (ver el
 * docstring del canvas). No es una pérdida de información ni de acción:
 * la tabla «Por municipio» de debajo lleva las mismas cifras y un botón
 * «Ver ficha» por fila que abre exactamente el mismo panel lateral que
 * pulsar la burbuja.
 */
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { formatCount } from "@/lib/metrics/format";
import type { MapBubble } from "@/lib/metrics/mapScale";

const TerritoryMapCanvas = dynamic(
  () => import("./TerritoryMapCanvas").then((module) => module.TerritoryMapCanvas),
  { ssr: false },
);

export interface TerritoryMapProps {
  bubbles: MapBubble[];
  onSelect: (ineCode: string) => void;
}

export function TerritoryMap({ bubbles, onSelect }: TerritoryMapProps) {
  const t = useTranslations("metrics.map");

  if (bubbles.length === 0) {
    return <p className="text-sm text-text-secondary">{t("empty")}</p>;
  }

  // `formatCount` es la única regla de supresión del panel: la burbuja
  // suprimida dice «<5» igual que su celda de la tabla, nunca «0».
  const labels = Object.fromEntries(
    bubbles.map((bubble) => [
      bubble.ineCode,
      t("bubbleLabel", {
        place: bubble.label,
        events: formatCount(bubble.events, false),
        people: formatCount(bubble.people, bubble.suppressed),
      }),
    ]),
  );

  return (
    <div
      role="img"
      aria-label={t("ariaLabel", { count: bubbles.length })}
      className="h-96 w-full overflow-hidden rounded-lg border border-border"
    >
      <TerritoryMapCanvas
        bubbles={bubbles}
        labels={labels}
        attribution={t("attribution")}
        onSelect={onSelect}
      />
    </div>
  );
}
