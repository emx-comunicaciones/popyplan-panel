import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { ApiError } from "@/lib/api/client";
import { getAccessToken, resetAccessTokenForTests, setAccessToken } from "@/lib/auth/tokenStore";

import { login, logout, restoreSession, useAccessToken } from "./useAuth";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  resetAccessTokenForTests();
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

describe("logout", () => {
  it("limpia el token en memoria y llama a DELETE /api/session", async () => {
    setAccessToken("token-vivo");
    fetchMock.mockResolvedValueOnce(response({}, 200));

    await logout();

    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/session", { method: "DELETE" });
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
