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
 * para poder importarlo así. Mientras el `import()` diferido se
 * resuelve, `next/dynamic` pinta `MapLoadingFallback` (`loading` de la
 * segunda llamada) en vez de nada — sin eso la caja se quedaba en blanco
 * un instante en cada visita (fix round 1, hallazgo menor).
 *
 * **Accesibilidad**: el contenedor es `role="img"` con un `aria-label`
 * que dice cuántos municipios hay, y nada dentro es enfocable (ver el
 * docstring del canvas). No es una pérdida de información ni de acción:
 * la tabla «Por municipio» de debajo lleva las mismas cifras y un botón
 * «Ver ficha» por fila que abre exactamente el mismo panel lateral que
 * pulsar la burbuja.
 *
 * **Atribución de OpenStreetMap (fix round 1, hallazgo importante del
 * coordinador):** la política de uso de teselas de OSM exige un aviso
 * «© OpenStreetMap contributors» visible con enlace a
 * `openstreetmap.org/copyright`. La primera versión de esta tarea
 * confiaba en el control de atribución por defecto de Leaflet para
 * eso — pero ese control es un `<a href>` real montado **dentro** del
 * `role="img"`, un elemento enfocable dentro de un rol que se declara no
 * interactivo (trampa de teclado). `TerritoryMapCanvas.tsx` desactiva
 * ahora ese control (`attributionControl={false}`) y el aviso se pinta
 * aquí, como un párrafo normal **fuera** de la caja `role="img"`, con
 * `t.rich("attribution", …)` envolviendo «OpenStreetMap» en un `<a>` de
 * verdad, focalizable y tabulable como cualquier enlace del panel.
 */
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { formatCount } from "@/lib/metrics/format";
import type { MapBubble } from "@/lib/metrics/mapScale";

/**
 * `loading` de `next/dynamic` es un componente aparte (no una función
 * en línea) porque necesita su propio `useTranslations`: `dynamic()` se
 * llama una vez a nivel de módulo, fuera de cualquier componente, así
 * que no puede usar el `t` de `TerritoryMap`. Se renderiza dentro del
 * mismo `role="img"` que ocupará el mapa real, sustituyendo a la caja en
 * blanco mientras `leaflet` termina de cargarse — nunca «0 municipios»
 * ni una caja vacía indistinguible de un fallo silencioso.
 */
function MapLoadingFallback() {
  const t = useTranslations("metrics.map");
  return <p className="p-4 text-sm text-text-secondary">{t("loading")}</p>;
}

const TerritoryMapCanvas = dynamic(
  () => import("./TerritoryMapCanvas").then((module) => module.TerritoryMapCanvas),
  { ssr: false, loading: MapLoadingFallback },
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
    <div>
      <div
        role="img"
        aria-label={t("ariaLabel", { count: bubbles.length })}
        className="h-96 w-full overflow-hidden rounded-lg border border-border"
      >
        <TerritoryMapCanvas bubbles={bubbles} labels={labels} onSelect={onSelect} />
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        {t.rich("attribution", {
          osm: (chunks) => (
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-primary-700 underline"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  );
}
