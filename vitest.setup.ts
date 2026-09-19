import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import { cleanup } from "@testing-library/react";
import React from "react";
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
 * Sin soporte de plurales/`select` de ICU todavía (ningún mensaje de la
 * tarea 1 los usa); si una tarea futura necesita probar uno, se amplía
 * aquí en vez de duplicar la resolución en cada test. Documentado
 * también en `test-utils/render.tsx::renderServer` y en `CLAUDE.md`
 * («Internacionalización»).
 */
function messageAt(path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined,
      esMessages,
    );
}

function interpolate(template: string, values?: Record<string, unknown>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

function fakeTranslator(namespace?: string) {
  return (key: string, values?: Record<string, unknown>) => {
    const raw = messageAt(namespace ? `${namespace}.${key}` : key);
    return typeof raw === "string" ? interpolate(raw, values) : key;
  };
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
