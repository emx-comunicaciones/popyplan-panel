import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

import { render } from "@/test-utils/render";
import { routerMock } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { awaitBootRestore, resetBootRestoreForTests } from "@/lib/auth/bootSession";

const bootRestoreSessionMock = vi.hoisted(() => vi.fn());
// `applyAccountLanguage` (tarea 6 de i18n): por defecto resuelve `false`
// (nada que sincronizar), como en la mayoría de estos tests, que no
// necesitan comprobar el `router.refresh()` condicional.
const applyAccountLanguageMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));
vi.mock("@/hooks/useAuth", () => ({
  bootRestoreSession: bootRestoreSessionMock,
  applyAccountLanguage: applyAccountLanguageMock,
}));

import { Providers } from "./providers";

afterEach(() => {
  bootRestoreSessionMock.mockReset();
  applyAccountLanguageMock.mockReset();
  applyAccountLanguageMock.mockResolvedValue(false);
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

  it("sin sesión al restaurar, no intenta sincronizar el idioma de la cuenta", async () => {
    bootRestoreSessionMock.mockReturnValue(Promise.resolve(null));

    render(
      <Providers>
        <p>contenido</p>
      </Providers>,
    );

    await awaitBootRestore();
    expect(applyAccountLanguageMock).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("con sesión, sincroniza el idioma de la cuenta y refresca solo si cambió", async () => {
    const me = buildMe({ preferred_language: "eu" });
    bootRestoreSessionMock.mockReturnValue(
      Promise.resolve({ accessToken: "token-1", user: me, platformRole: { role: null } }),
    );
    applyAccountLanguageMock.mockResolvedValueOnce(true);

    render(
      <Providers>
        <p>contenido</p>
      </Providers>,
    );

    await waitFor(() => expect(applyAccountLanguageMock).toHaveBeenCalledWith(me));
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
  });

  it("con sesión pero sin cambio de idioma, no refresca", async () => {
    const me = buildMe();
    bootRestoreSessionMock.mockReturnValue(
      Promise.resolve({ accessToken: "token-1", user: me, platformRole: { role: null } }),
    );

    render(
      <Providers>
        <p>contenido</p>
      </Providers>,
    );

    await waitFor(() => expect(applyAccountLanguageMock).toHaveBeenCalledWith(me));
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });
});
