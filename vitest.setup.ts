import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { redirectMock, resetNextNavigationMocks, routerMock } from "./test-utils/nextNavigationMock";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: redirectMock,
}));

afterEach(() => {
  // Vitest no expone `afterEach` en `globalThis` sin `test.globals: true`,
  // así que Testing Library no engancha su cleanup automático: se llama
  // explícitamente para no arrastrar el DOM de un test a otro.
  cleanup();
  resetNextNavigationMocks();
});
