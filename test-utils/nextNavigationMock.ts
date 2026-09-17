/**
 * Mock compartido de `next/navigation`, registrado una sola vez en
 * `vitest.setup.ts` (`vi.mock`). Los tests importan `routerMock` y
 * `redirectMock` desde aquí para hacer aserciones; `resetNextNavigationMocks`
 * se llama en un `afterEach` global para no arrastrar llamadas entre tests.
 */
import { vi } from "vitest";

/** `redirect()` real de Next.js interrumpe el render lanzando una excepción especial. */
export class NextRedirectSignal extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`NEXT_REDIRECT:${url}`);
    this.url = url;
  }
}

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export const redirectMock = vi.fn((url: string): never => {
  throw new NextRedirectSignal(url);
});

/** `notFound()` real de Next.js interrumpe el render igual que `redirect()`. */
export class NextNotFoundSignal extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}

export const notFoundMock = vi.fn((): never => {
  throw new NextNotFoundSignal();
});

/**
 * Parámetros de consulta que devuelve `useSearchParams()`. Un test que
 * los necesite (p. ej. el `returnTo` del login) los fija con
 * `setSearchParams`; el `afterEach` global los vacía.
 */
let searchParams = new URLSearchParams();

export function getSearchParamsMock(): URLSearchParams {
  return searchParams;
}

export function setSearchParams(init: string | Record<string, string>): void {
  searchParams = new URLSearchParams(init);
}

export function resetNextNavigationMocks(): void {
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routerMock.back.mockClear();
  routerMock.refresh.mockClear();
  routerMock.prefetch.mockClear();
  redirectMock.mockClear();
  notFoundMock.mockClear();
  searchParams = new URLSearchParams();
}
