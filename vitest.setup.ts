import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import { cleanup } from "@testing-library/react";
import React from "react";
import { createTranslator, type NamespaceKeys, type NestedKeyOf } from "use-intl/core";
import { afterEach, vi } from "vitest";

import esMessages from "./messages/es.json";
import {
  getPathnameMock,
  getSearchParamsMock,
  notFoundMock,
  redirectMock,
  resetNextNavigationMocks,
  routerMock,
} from "./test-utils/nextNavigationMock";

/**
 * `next/font/google` no tiene implementación fuera del build de Next: el
 * compilador (plugin SWC) sustituye cada llamada por el objeto ya
 * generado, así que bajo Vitest el módulo no sirve de nada. El mock
 * devuelve la forma mínima que consumen los dos sitios que declaran
 * fuentes — `app/layout.tsx` (Geist, el panel) y
 * `components/landing/fonts.ts` (Plus Jakarta Sans + DM Sans, solo la
 * web pública) — para que un test que renderice cualquiera de los dos
 * árboles no tenga que mockearlo por su cuenta. `app/layout.test.tsx`
 * mantiene además su propio `vi.mock` del módulo (más específico, tiene
 * precedencia en ese fichero).
 */
vi.mock("next/font/google", () => {
  const font = (variable: string) => () => ({ variable, className: variable });
  return {
    Geist: font("--font-geist-sans"),
    Geist_Mono: font("--font-geist-mono"),
    Plus_Jakarta_Sans: font("--font-plus-jakarta-sans"),
    DM_Sans: font("--font-dm-sans"),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => getPathnameMock(),
  useSearchParams: () => getSearchParamsMock(),
  redirect: redirectMock,
  notFound: notFoundMock,
}));

/**
 * `next-intl/server` (`getLocale`/`getMessages`/`getTranslations`) no se
 * puede ejecutar de verdad bajo Vitest+jsdom: el paquete resuelve a su
 * condición `react-client`, que lanza `` `getRequestConfig` is not
 * supported in Client Components `` en cuanto algo (p. ej.
 * `i18n/request.ts`, o un `page.tsx` que llame a `getTranslations`)
 * importa esas funciones sin pasar por el runtime real de Next
 * (verificado al escribir la tarea de infraestructura de i18n). El mock
 * global fija el idioma de los tests a `es` (misma decisión que
 * `test-utils/render.tsx::render`) y resuelve las claves contra el
 * catálogo real de `messages/es.json` — nunca contra cadenas
 * inventadas — para que una clave que falte rompa el test que la usa.
 *
 * **Fix round 1 (revisión del coordinador de la tarea 1):** la primera
 * versión de este mock interpolaba `{name}` a mano con una expresión
 * regular y no entendía ICU `plural`/`select` — un Server Component que
 * pintara, p. ej., «{count, plural, one {# elemento} other {#
 * elementos}}» habría visto la cadena ICU cruda en vez del texto
 * traducido en las tareas 3-5. Ahora el mock delega en
 * `createTranslator` de `use-intl/core` (la misma pieza que usa
 * internamente `next-intl` tanto en `getTranslations` real como en
 * `useTranslations`/`NextIntlClientProvider` del lado de cliente, que sí
 * se ejecuta de verdad en los tests — ver `test-utils/render.tsx`), así
 * que el formateo ICU (plurales, `select`, números/fechas incrustados)
 * es idéntico al del runtime, no una reimplementación parcial.
 * `onError` relanza el error en vez de tragárselo (el valor por defecto
 * de `use-intl` es `console.error` + una cadena de repuesto), para
 * mantener la garantía de que una clave que falte rompe el test que la
 * usa. Ver `lib/i18n/messages.test.ts` (paridad de parámetros ICU) y
 * `test-utils/render.test.tsx` (prueba end-to-end del plural
 * `common.items`).
 */
type EsMessages = typeof esMessages;
// `getTranslations(namespace)` recibe el namespace como `string` en tiempo
// de ejecución (viene de un argumento de página, no de un literal), pero
// `createTranslator` lo tipa como una unión cerrada de las rutas reales
// del catálogo — el cast estrecha a ese tipo conocido en vez de a `any`.
type EsNamespace = NamespaceKeys<EsMessages, NestedKeyOf<EsMessages>>;

function fakeTranslator(namespace?: string) {
  return createTranslator<EsMessages, EsNamespace>({
    locale: "es",
    messages: esMessages,
    namespace: namespace as EsNamespace | undefined,
    onError: (error) => {
      throw error;
    },
  });
}

vi.mock("next-intl/server", () => ({
  getLocale: async () => "es",
  getMessages: async () => esMessages,
  getTranslations: async (namespaceOrOptions?: string | { namespace?: string }) =>
    fakeTranslator(typeof namespaceOrOptions === "string" ? namespaceOrOptions : namespaceOrOptions?.namespace),
  setRequestLocale: () => {},
  // `i18n/request.ts` es el único consumidor: en el `next-intl` real,
  // `getRequestConfig(fn)` envuelve `fn` para que el runtime lo llame con
  // los parámetros de la petición; aquí basta la identidad para poder
  // invocar `fn(params)` directamente desde `i18n/request.test.ts`.
  getRequestConfig: <T,>(createConfig: T) => createConfig,
}));

/**
 * `recharts` (`components/metrics/SeriesChart.tsx`) mide el contenedor
 * con `ResizeObserver`, que jsdom no implementa: sin este mock,
 * `ResponsiveContainer` nunca pinta sus hijos y los tests no pueden ver
 * la serie mensual. Se sustituye por un `<div>` de tamaño fijo que
 * inyecta `width`/`height` en su hijo (igual que el `ResponsiveContainer`
 * real de recharts v3 con `cloneElement`), así el `<svg>` sí se pinta en
 * jsdom; el resto de `recharts` (los propios `<Line>`/`<XAxis>`/…) se
 * mantiene real.
 */
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactElement<{ width?: number; height?: number }>;
    }) =>
      React.createElement(
        "div",
        { style: { width: 400, height: 280 } },
        React.cloneElement(children, { width: 400, height: 280 }),
      ),
  };
});

/**
 * `react-leaflet` monta un mapa real de `leaflet` sobre el DOM: mide el
 * contenedor, carga teselas por red y usa APIs de canvas/SVG que jsdom no
 * implementa. Mismo problema y misma solución que `ResponsiveContainer`
 * de `recharts` (arriba): se sustituyen las cuatro primitivas que usa
 * `components/metrics/TerritoryMapCanvas.tsx` por elementos planos que sí
 * se pueden inspeccionar desde un test.
 *
 * `CircleMarker` se sustituye por un `<button>` **de verdad** —no un
 * `<div>`— porque lo que hay que poder probar es que pulsar una burbuja
 * abre la ficha de ese municipio; en el mapa real, el `eventHandlers`
 * de `CircleMarker` hace ese mismo papel. Sus hijos (`<Tooltip>`) se
 * pintan dentro, así que el nombre accesible del botón es el texto del
 * tooltip.
 *
 * **Fix round 1 (revisión del coordinador de la tarea 4):** `MapContainer`
 * expone ahora `attributionControl` como `data-attribution-control` en el
 * `<div>` mockeado, para poder comprobar desde un test que
 * `TerritoryMapCanvas.tsx` lo pasa a `false` — sin eso, el control de
 * atribución real de Leaflet monta un `<a href="https://leafletjs.com">`
 * enfocable dentro del `role="img"` de `TerritoryMap.tsx`, una trampa de
 * teclado en un contenedor que se declara no interactivo.
 */
/**
 * `TerritoryMapCanvas.tsx` importa `leaflet/dist/leaflet.css` a nivel de
 * módulo (necesario para que los `CircleMarker`/`Tooltip` reales se vean
 * bien fuera de test). Bajo Vitest, ese `.css` pasa por el `postcss.config.mjs`
 * real del proyecto (`@tailwindcss/postcss`), que no es válido fuera del
 * pipeline de build de Next y hace fallar la transformación de Vite —
 * mismo problema, mismo remedio que `app/layout.test.tsx` mockeando
 * `./globals.css`. Sin este mock, el `import()` diferido de
 * `next/dynamic` rechaza en silencio y el mapa se queda «cargando» para
 * siempre en los tests.
 */
vi.mock("leaflet/dist/leaflet.css", () => ({}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({
    children,
    attributionControl,
  }: {
    children: React.ReactNode;
    attributionControl?: boolean;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "map-container", "data-attribution-control": String(attributionControl) },
      children,
    ),
  TileLayer: () => React.createElement("div", { "data-testid": "tile-layer" }),
  CircleMarker: ({
    children,
    eventHandlers,
  }: {
    children?: React.ReactNode;
    eventHandlers?: { click?: () => void };
  }) =>
    // `<span role="button">`, no `<button>` (fix round 1): un
    // `CircleMarker` real de Leaflet es una forma SVG con un manejador de
    // clic propio, nunca un elemento nativamente enfocable — y
    // `TerritoryMap.tsx` declara su contenedor `role="img"` sin ningún
    // descendiente enfocable. Un `<button>` real (incluso con
    // `tabIndex={-1}`, probado y rechazado: axe avisa de que la tecnología
    // de asistencia puede enfocarlo igual) sí lo es, y disparaba
    // «nested-interactive» en cuanto la carga diferida se resolvía antes
    // del `axe()` del test. `role="button"` conserva `getByRole("button",
    // …)` y el clic con `userEvent`/`fireEvent` (que no exige que el
    // elemento sea focalizable) sin añadir un descendiente focalizable de
    // verdad — el mismo comportamiento del `CircleMarker` real.
    React.createElement(
      "span",
      { role: "button", onClick: () => eventHandlers?.click?.() },
      children,
    ),
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement("span", null, children),
}));

afterEach(() => {
  // Vitest no expone `afterEach` en `globalThis` sin `test.globals: true`,
  // así que Testing Library no engancha su cleanup automático: se llama
  // explícitamente para no arrastrar el DOM de un test a otro.
  cleanup();
  resetNextNavigationMocks();
});
