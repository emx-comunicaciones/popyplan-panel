import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test-utils/render";
import { awaitBootRestore, resetBootRestoreForTests } from "@/lib/auth/bootSession";

const bootRestoreSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({ bootRestoreSession: bootRestoreSessionMock }));

import { Providers } from "./providers";

afterEach(() => {
  bootRestoreSessionMock.mockReset();
  resetBootRestoreForTests();
});

describe("Providers", () => {
  it("registra la restauración de sesión de arranque para que apiFetch la espere", async () => {
    let resolveRestore: () => void = () => undefined;
    bootRestoreSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRestore = () => resolve(null);
      }),
    );

    render(
      <Providers>
        <p>contenido</p>
      </Providers>,
    );

    expect(bootRestoreSessionMock).toHaveBeenCalledTimes(1);

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
    bootRestoreSessionMock.mockReturnValue(Promise.resolve(null));

    const { getByText } = render(
      <Providers>
        <p>contenido de la app</p>
      </Providers>,
    );

    expect(getByText("contenido de la app")).toBeInTheDocument();
  });
});
