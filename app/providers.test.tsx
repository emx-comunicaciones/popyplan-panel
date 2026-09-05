import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test-utils/render";
import { awaitBootRestore, resetBootRestoreForTests } from "@/lib/auth/bootSession";

const restoreSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({ restoreSession: restoreSessionMock }));

import { Providers } from "./providers";

afterEach(() => {
  restoreSessionMock.mockReset();
  resetBootRestoreForTests();
});

describe("Providers", () => {
  it("registra la restauración de sesión de arranque para que apiFetch la espere", async () => {
    let resolveRestore: () => void = () => undefined;
    restoreSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRestore = () => resolve(null);
      }),
    );

    render(
      <Providers>
        <p>contenido</p>
      </Providers>,
    );

    expect(restoreSessionMock).toHaveBeenCalledTimes(1);

    let settled = false;
    const pending = awaitBootRestore().then(() => {
      settled = true;
    });
    expect(settled).toBe(false);

    resolveRestore();
    await pending;
    expect(settled).toBe(true);
  });

  it("pinta a los hijos", () => {
    restoreSessionMock.mockReturnValue(Promise.resolve(null));

    const { getByText } = render(
      <Providers>
        <p>contenido de la app</p>
      </Providers>,
    );

    expect(getByText("contenido de la app")).toBeInTheDocument();
  });
});
