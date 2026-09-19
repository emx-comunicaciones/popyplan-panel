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

afterEach(() => {
  // Vitest no expone `afterEach` en `globalThis` sin `test.globals: true`,
  // así que Testing Library no engancha su cleanup automático: se llama
  // explícitamente para no arrastrar el DOM de un test a otro.
  cleanup();
  resetNextNavigationMocks();
});
