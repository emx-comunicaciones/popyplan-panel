import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetAccessTokenForTests, setAccessToken, getAccessToken } from "@/lib/auth/tokenStore";

import { ApiError, apiFetch } from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetAccessTokenForTests();
});

function response(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("apiFetch", () => {
  it("añade el Bearer del token en memoria y devuelve el cuerpo", async () => {
    setAccessToken("token-vivo");
    fetchMock.mockResolvedValueOnce(response({ id: 1 }, 200));

    const data = await apiFetch("/api/organizations/7/");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/organizations/7/",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-vivo" }),
      }),
    );
    expect(data).toEqual({ id: 1 });
  });

  it("401 → refresca vía /api/session/refresh → reintenta con el token nuevo", async () => {
    setAccessToken("token-caducado");
    fetchMock
      .mockResolvedValueOnce(response({ detail: "expirado" }, 401)) // llamada original
      .mockResolvedValueOnce(response({ accessToken: "token-nuevo" }, 200)) // /api/session/refresh
      .mockResolvedValueOnce(response({ id: 1 }, 200)); // reintento

    const data = await apiFetch("/api/organizations/7/");

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/session/refresh", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://api.test/api/organizations/7/",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-nuevo" }),
      }),
    );
    expect(data).toEqual({ id: 1 });
    expect(getAccessToken()).toBe("token-nuevo");
  });

  it("refresco fallido → limpia el token en memoria (logout) y lanza ApiError 401", async () => {
    setAccessToken("token-caducado");
    fetchMock
      .mockResolvedValueOnce(response({ detail: "expirado" }, 401))
      .mockResolvedValueOnce(response({ detail: "sin sesión" }, 401)); // /api/session/refresh falla

    await expect(apiFetch("/api/organizations/7/")).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });

  it("si /api/session/refresh falla de red (excepción), también limpia el token y lanza ApiError", async () => {
    setAccessToken("token-caducado");
    fetchMock
      .mockResolvedValueOnce(response({ detail: "expirado" }, 401))
      .mockRejectedValueOnce(new Error("network down"));

    await expect(apiFetch("/api/organizations/7/")).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });

  it("un error con cuerpo no JSON no revienta: ApiError.body queda null", async () => {
    setAccessToken("token-vivo");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "<html>no soy json</html>",
    } as Response);

    const error = await apiFetch("/api/organizations/7/").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).body).toBeNull();
  });

  it("un error que no es 401 no intenta refrescar y lanza ApiError con el cuerpo", async () => {
    setAccessToken("token-vivo");
    fetchMock.mockResolvedValueOnce(response({ detail: "no encontrado" }, 404));

    const error = await apiFetch("/api/organizations/999/").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).body).toEqual({ detail: "no encontrado" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("204 se resuelve sin cuerpo", async () => {
    setAccessToken("token-vivo");
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, text: async () => "" } as Response);

    const data = await apiFetch("/api/session/");

    expect(data).toBeUndefined();
  });
});
