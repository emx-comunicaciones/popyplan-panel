import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { serverFetch } from "./serverFetch";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("serverFetch", () => {
  it("añade el Bearer y llama a la URL del backend configurada", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await serverFetch("/api/users/users/me/", "token-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/users/users/me/",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      }),
    );
    expect(result).toEqual({ ok: true, status: 200, data: { ok: true } });
  });

  it("devuelve ok:false con el cuerpo del error si el backend responde con fallo", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "no autorizado" }, 401));

    const result = await serverFetch("/api/users/users/me/", "token-malo");

    expect(result).toEqual({ ok: false, status: 401, body: { detail: "no autorizado" } });
  });

  it("un 204 sin cuerpo se resuelve con data undefined", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("sin cuerpo");
      },
      text: async () => "",
    } as unknown as Response);

    const result = await serverFetch("/api/session/", "token-123");

    expect(result).toEqual({ ok: true, status: 204, data: undefined });
  });

  it("un error sin cuerpo JSON válido no revienta: body queda null", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("no es JSON");
      },
      text: async () => "",
    } as unknown as Response);

    const result = await serverFetch("/api/users/users/me/", "token-123");

    expect(result).toEqual({ ok: false, status: 500, body: null });
  });

  it("una respuesta 200 con cuerpo vacío se resuelve con data undefined", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
    } as Response);

    const result = await serverFetch("/api/organizations/7/scope/", "token-123");

    expect(result).toEqual({ ok: true, status: 200, data: undefined });
  });

  it("una respuesta 200 con cuerpo no JSON no revienta: se trata como error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "<html>página de error del proxy</html>",
    } as Response);

    const result = await serverFetch("/api/users/users/me/", "token-123");

    expect(result).toEqual({ ok: false, status: 200, body: null });
  });

  it("sin NEXT_PUBLIC_API_URL cae al backend local por defecto", async () => {
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_API_URL;
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await serverFetch("/api/users/users/me/", "token-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8001/api/users/users/me/",
      expect.anything(),
    );
  });
});
