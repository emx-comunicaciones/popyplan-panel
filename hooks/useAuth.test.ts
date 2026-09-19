import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { ApiError } from "@/lib/api/client";
import { getAccessToken, resetAccessTokenForTests, setAccessToken } from "@/lib/auth/tokenStore";

import {
  applyAccountLanguage,
  bootRestoreSession,
  login,
  logout,
  resetBootRestoreSessionForTests,
  restoreSession,
  useAccessToken,
} from "./useAuth";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  resetAccessTokenForTests();
  resetBootRestoreSessionForTests();
});

function response(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("login", () => {
  it("guarda el access token en memoria y devuelve la sesión", async () => {
    const me = buildMe();
    const platformRole = buildPlatformRole(null);
    fetchMock.mockResolvedValueOnce(
      response({ accessToken: "token-1", user: me, platformRole }, 200),
    );

    const session = await login("titular@alfaville.test", "correcta-1234");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          username_or_email: "titular@alfaville.test",
          password: "correcta-1234",
        }),
      }),
    );
    expect(session.accessToken).toBe("token-1");
    expect(getAccessToken()).toBe("token-1");
  });

  it("credenciales incorrectas (400) lanzan ApiError y no tocan el token", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "Credenciales inválidas" }, 400));

    await expect(login("titular@alfaville.test", "mala")).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });

  it("un error del backend sin cuerpo JSON parseable también lanza ApiError", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("no es JSON");
      },
    } as unknown as Response);

    const error = await login("titular@alfaville.test", "mala").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).body).toBeNull();
  });
});

describe("restoreSession", () => {
  it("con cookie viva actualiza el token en memoria", async () => {
    const me = buildMe();
    fetchMock.mockResolvedValueOnce(
      response({ accessToken: "token-cookie", user: me, platformRole: buildPlatformRole(null) }, 200),
    );

    const session = await restoreSession();

    expect(fetchMock).toHaveBeenCalledWith("/api/session/refresh", { method: "POST" });
    expect(session?.accessToken).toBe("token-cookie");
    expect(getAccessToken()).toBe("token-cookie");
  });

  it("sin cookie viva limpia el token y devuelve null", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "sin sesión" }, 401));

    const session = await restoreSession();

    expect(session).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});

describe("bootRestoreSession", () => {
  it("dos llamadas (StrictMode monta dos veces) comparten un solo refresco", async () => {
    const me = buildMe();
    fetchMock.mockResolvedValue(
      response({ accessToken: "token-boot", user: me, platformRole: buildPlatformRole(null) }, 200),
    );

    const [first, second] = await Promise.all([bootRestoreSession(), bootRestoreSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(getAccessToken()).toBe("token-boot");
  });

  it("también comparte el resultado si la segunda llamada llega cuando la primera ya terminó", async () => {
    fetchMock.mockResolvedValue(response({ detail: "sin sesión" }, 401));

    await bootRestoreSession();
    await bootRestoreSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("logout", () => {
  it("limpia el token en memoria y llama a DELETE /api/session", async () => {
    setAccessToken("token-vivo");
    fetchMock.mockResolvedValueOnce(response({}, 200));

    await logout();

    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ method: "DELETE", signal: expect.any(AbortSignal) }),
    );
  });

  it("si el backend no responde, aborta al cabo de 5 s y resuelve igual (best-effort)", async () => {
    vi.useFakeTimers();
    setAccessToken("token-vivo");
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("La operación fue abortada.", "AbortError")),
          );
        }),
    );

    const pending = logout();
    await vi.advanceTimersByTimeAsync(5000);
    await pending;

    expect(getAccessToken()).toBeNull();
    vi.useRealTimers();
  });
});

describe("useAccessToken", () => {
  it("refleja los cambios del token en memoria", async () => {
    const { result } = renderHook(() => useAccessToken());

    expect(result.current).toBeNull();

    setAccessToken("token-reactivo");

    await waitFor(() => expect(result.current).toBe("token-reactivo"));
  });
});

/**
 * `applyAccountLanguage` (spec de diseño `2026-09-19-i18n-es-eu-ca`,
 * decisión 2): `document.cookie` es real en jsdom, así que cada test
 * limpia `pp_lang` explícitamente en vez de confiar en el `afterEach`
 * global (que resetea mocks, no el DOM).
 */
describe("applyAccountLanguage", () => {
  afterEach(() => {
    document.cookie = "pp_lang=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  });

  it("con preferred_language vacío, no llama a /api/lang y devuelve false", async () => {
    const changed = await applyAccountLanguage(buildMe({ preferred_language: "" }));

    expect(changed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con un idioma no soportado, no llama a /api/lang y devuelve false", async () => {
    const changed = await applyAccountLanguage(buildMe({ preferred_language: "de" as never }));

    expect(changed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con un idioma soportado distinto de la cookie actual, fija la cookie y devuelve true", async () => {
    document.cookie = "pp_lang=es; path=/";
    fetchMock.mockResolvedValueOnce(response(null, 204));

    const changed = await applyAccountLanguage(buildMe({ preferred_language: "eu" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/lang", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: "eu" }),
    });
    expect(changed).toBe(true);
  });

  it("si la cookie ya tiene ese idioma, no llama a /api/lang y devuelve false", async () => {
    document.cookie = "pp_lang=eu; path=/";

    const changed = await applyAccountLanguage(buildMe({ preferred_language: "eu" }));

    expect(changed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un fallo de red al fijar la cookie no lanza: devuelve false", async () => {
    fetchMock.mockRejectedValueOnce(new Error("red caída"));

    const changed = await applyAccountLanguage(buildMe({ preferred_language: "ca" }));

    expect(changed).toBe(false);
  });
});
