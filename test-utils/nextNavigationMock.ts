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

export function resetNextNavigationMocks(): void {
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routerMock.back.mockClear();
  routerMock.refresh.mockClear();
  routerMock.prefetch.mockClear();
  redirectMock.mockClear();
}
