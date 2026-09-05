import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import { cleanup } from "@testing-library/react";
import React from "react";
import { afterEach, vi } from "vitest";

import { redirectMock, resetNextNavigationMocks, routerMock } from "./test-utils/nextNavigationMock";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: redirectMock,
}));

/**
 * `recharts` (`components/metrics/SeriesChart.tsx`) mide el contenedor
 * con `ResizeObserver`, que jsdom no implementa: sin este mock,
 * `ResponsiveContainer` nunca pinta sus hijos y los tests no pueden ver
 * la serie mensual. Se sustituye por un `<div>` de tamaño fijo; el resto
 * de `recharts` (los propios `<Line>`/`<XAxis>`/…) se mantiene real.
 */
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { style: { width: 400, height: 280 } }, children),
  };
});

afterEach(() => {
  // Vitest no expone `afterEach` en `globalThis` sin `test.globals: true`,
  // así que Testing Library no engancha su cleanup automático: se llama
  // explícitamente para no arrastrar el DOM de un test a otro.
  cleanup();
  resetNextNavigationMocks();
});
