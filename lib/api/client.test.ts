import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerBootRestore, resetBootRestoreForTests } from "@/lib/auth/bootSession";
import {
  resetSessionEventsForTests,
  SESSION_EXPIRED_MESSAGE,
  subscribeSessionExpired,
} from "@/lib/auth/sessionEvents";
import { resetAccessTokenForTests, setAccessToken, getAccessToken } from "@/lib/auth/tokenStore";

import { ApiError, apiFetch, fetchWithAuth } from "./client";

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
  resetBootRestoreForTests();
  resetSessionEventsForTests();
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

  it("bug crítico de demo: varios 401 concurrentes disparan un único refresco", async () => {
    setAccessToken("token-caducado");
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/session/refresh") {
        return Promise.resolve(response({ accessToken: "token-nuevo" }, 200));
      }
      const headers = options?.headers as Record<string, string> | undefined;
      if (headers?.Authorization === "Bearer token-nuevo") {
        return Promise.resolve(response({ ok: true }, 200));
      }
      return Promise.resolve(response({ detail: "expirado" }, 401));
    });

    const [a, b, c] = await Promise.all([
      apiFetch("/api/a/"),
      apiFetch("/api/b/"),
      apiFetch("/api/c/"),
    ]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/session/refresh");
    expect(refreshCalls).toHaveLength(1);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(c).toEqual({ ok: true });
    expect(getAccessToken()).toBe("token-nuevo");
  });

  it("sin token en memoria, espera la restauración de arranque antes de disparar la petición", async () => {
    resetAccessTokenForTests();
    let resolveBoot: () => void = () => undefined;
    const bootPromise = new Promise<void>((resolve) => {
      resolveBoot = resolve;
    });
    registerBootRestore(bootPromise);

    fetchMock.mockResolvedValueOnce(response({ id: 1 }, 200));

    const pending = apiFetch("/api/organizations/7/");
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();

    setAccessToken("token-tras-arranque");
    resolveBoot();

    const data = await pending;

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/organizations/7/",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-tras-arranque" }),
      }),
    );
    expect(data).toEqual({ id: 1 });
  });

  it("un body FormData se manda tal cual, sin Content-Type forzado (subida de recurso)", async () => {
    setAccessToken("token-vivo");
    fetchMock.mockResolvedValueOnce(response({ id: 1 }, 200));

    const formData = new FormData();
    formData.append("title", "Guía");

    await apiFetch("/api/organizations/7/resources/", { method: "POST", body: formData });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(formData);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("refresco fallido avisa una vez a lib/auth/sessionEvents con el mensaje del contrato", async () => {
    setAccessToken("token-caducado");
    fetchMock
      .mockResolvedValueOnce(response({ detail: "expirado" }, 401))
      .mockResolvedValueOnce(response({ detail: "sin sesión" }, 401));

    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpired(listener);

    const error = await apiFetch("/api/organizations/7/").catch((caught) => caught);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe(SESSION_EXPIRED_MESSAGE);
    unsubscribe();
  });

  it("si el reintento tras refrescar vuelve a dar 401, limpia el token y notifica sesión expirada", async () => {
    setAccessToken("token-caducado");
    fetchMock
      .mockResolvedValueOnce(response({ detail: "expirado" }, 401))
      .mockResolvedValueOnce(response({ accessToken: "token-nuevo" }, 200))
      .mockResolvedValueOnce(response({ detail: "sigue sin valer" }, 401)); // reintento

    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpired(listener);

    const error = await apiFetch("/api/organizations/7/").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("un 503 del route handler de refresco lanza ApiError(503) SIN logout ni notificación", async () => {
    setAccessToken("token-caducado");
    fetchMock
      .mockResolvedValueOnce(response({ detail: "expirado" }, 401))
      .mockResolvedValueOnce(response({ detail: "No se pudo completar el refresco." }, 503));

    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpired(listener);

    const error = await apiFetch("/api/organizations/7/").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
    expect((error as ApiError).body).toEqual({ detail: "No se pudo completar el refresco." });
    expect(getAccessToken()).toBe("token-caducado");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("fetchWithAuth", () => {
  it("devuelve el Response sin parsear en un 200 (descarga de fichero)", async () => {
    setAccessToken("token-vivo");
    const fileResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/csv" }),
    } as Response;
    fetchMock.mockResolvedValueOnce(fileResponse);

    const res = await fetchWithAuth("/api/panel/entidad/7/export/?format=csv");

    expect(res).toBe(fileResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/panel/entidad/7/export/?format=csv",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-vivo" }),
      }),
    );
  });

  it("en !ok lanza ApiError con el cuerpo parseado, igual que apiFetch", async () => {
    setAccessToken("token-vivo");
    fetchMock.mockResolvedValueOnce(response({ detail: "prohibido" }, 403));

    const error = await fetchWithAuth("/api/panel/entidad/7/export/?format=pdf").catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).body).toEqual({ detail: "prohibido" });
  });

  it("401 → refresca vía /api/session/refresh → reintenta con el token nuevo", async () => {
    setAccessToken("token-caducado");
    const fileResponse = { ok: true, status: 200 } as Response;
    fetchMock
      .mockResolvedValueOnce(response({ detail: "expirado" }, 401))
      .mockResolvedValueOnce(response({ accessToken: "token-nuevo" }, 200))
      .mockResolvedValueOnce(fileResponse);

    const res = await fetchWithAuth("/api/panel/entidad/7/programs/3/report/?format=csv");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/session/refresh", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://api.test/api/panel/entidad/7/programs/3/report/?format=csv",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-nuevo" }),
      }),
    );
    expect(res).toBe(fileResponse);
    expect(getAccessToken()).toBe("token-nuevo");
  });

  it("un 503 del route handler de refresco lanza ApiError(503) y NO notifica sesión expirada", async () => {
    setAccessToken("token-caducado");
    fetchMock
      .mockResolvedValueOnce(response({ detail: "expirado" }, 401))
      .mockResolvedValueOnce(response({ detail: "No se pudo completar el refresco." }, 503));

    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpired(listener);

    const error = await fetchWithAuth("/api/panel/entidad/7/export/").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
    expect(getAccessToken()).toBe("token-caducado");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("si el reintento vuelve a dar 401, limpia el token y notifica sesión expirada", async () => {
    setAccessToken("token-caducado");
    fetchMock
      .mockResolvedValueOnce(response({ detail: "expirado" }, 401))
      .mockResolvedValueOnce(response({ accessToken: "token-nuevo" }, 200))
      .mockResolvedValueOnce(response({ detail: "sigue sin valer" }, 401));

    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpired(listener);

    const error = await fetchWithAuth("/api/panel/entidad/7/export/").catch((caught) => caught);

    expect((error as ApiError).status).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
