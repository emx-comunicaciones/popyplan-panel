// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie";

import { POST } from "./route";

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

function response(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

/**
 * Cada caso usa un valor de refresh distinto: el módulo de la ruta guarda
 * las rotaciones recientes en un mapa a nivel de módulo (10 s, para no
 * tirar la sesión de un segundo refresco con la cookie vieja) que no se
 * puede resetear desde fuera — un fichero `route.ts` solo puede exportar
 * manejadores HTTP.
 */
function requestWithCookie(value: string | undefined, headers?: Record<string, string>) {
  const req = new NextRequest("http://panel.test/api/session/refresh", { method: "POST", headers });
  if (value !== undefined) {
    req.cookies.set(SESSION_COOKIE_NAME, value);
  }
  return req;
}

const REFRESH_URL = "http://api.test/api/auth/token/refresh/";

function refreshCalls(): unknown[][] {
  return fetchMock.mock.calls.filter((call) => call[0] === REFRESH_URL);
}

describe("POST /api/session/refresh", () => {
  it("sin cookie responde 401 sin llamar al backend", async () => {
    const res = await POST(requestWithCookie(undefined));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con refresh válido: rota el token, guarda el refresh nuevo y trae datos frescos", async () => {
    const me = buildMe();
    const platformRole = buildPlatformRole(null);
    fetchMock
      .mockResolvedValueOnce(response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200))
      .mockResolvedValueOnce(response(me, 200))
      .mockResolvedValueOnce(response(platformRole, 200));

    const res = await POST(requestWithCookie("r-ok"));
    const data = await res.json();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      REFRESH_URL,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh: "r-ok" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(data).toEqual({ accessToken: "access-nuevo", user: me, platformRole });
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("refresh-nuevo");
  });

  it("con refresh caducado o en lista negra (401 del backend), borra la cookie y responde 401", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ detail: "Token is invalid or expired", code: "token_not_valid" }, 401),
    );

    const res = await POST(requestWithCookie("r-caducado"));

    expect(res.status).toBe(401);
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });

  it("si el token se rota bien pero /me falla después, responde 503 PRESERVANDO la sesión (cookie con el refresh nuevo)", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200))
      .mockResolvedValueOnce(response({ detail: "error" }, 502))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200));

    const res = await POST(requestWithCookie("r-sin-perfil"));

    expect(res.status).toBe(503);
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("refresh-nuevo");
    expect(cookie?.maxAge).not.toBe(0);
  });

  it("si el token se rota bien pero /me falla en red, conserva igualmente el refresh nuevo", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === REFRESH_URL) {
        return Promise.resolve(response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200));
      }
      return Promise.reject(new Error("red caída"));
    });

    const res = await POST(requestWithCookie("r-perfil-sin-red"));

    expect(res.status).toBe(503);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("refresh-nuevo");
  });

  it("error de red al refrescar: 503 SIN borrar la cookie (la sesión sigue válida)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("red caída"));

    const res = await POST(requestWithCookie("r-red"));

    expect(res.status).toBe(503);
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("respuesta del backend ilegible (no es JSON): 503 SIN borrar la cookie", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("no es JSON");
      },
    } as unknown as Response);

    const res = await POST(requestWithCookie("r-basura"));

    expect(res.status).toBe(503);
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("respuesta del backend sin access/refresh: 503 SIN borrar la cookie", async () => {
    fetchMock.mockResolvedValueOnce(response({ access: "solo-access" }, 200));

    const res = await POST(requestWithCookie("r-incompleto"));

    expect(res.status).toBe(503);
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("reenvía al backend la IP real del cliente (rate limit por IP compartido con el login)", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ access: "a", refresh: "r" }, 200))
      .mockResolvedValueOnce(response(buildMe(), 200))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200));

    await POST(requestWithCookie("r-ip", { "x-forwarded-for": "203.0.113.7, 70.41.3.18" }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      REFRESH_URL,
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Forwarded-For": "203.0.113.7" }),
      }),
    );
  });

  it("dos refrescos concurrentes con la misma cookie disparan UNA sola rotación en el backend", async () => {
    const me = buildMe();
    const platformRole = buildPlatformRole(null);
    let resolveRefresh: (value: Response) => void = () => undefined;
    fetchMock.mockImplementation((url: string) => {
      if (url === REFRESH_URL) {
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        });
      }
      return Promise.resolve(response(url.includes("platform-roles") ? platformRole : me, 200));
    });

    const first = POST(requestWithCookie("r-concurrente"));
    const second = POST(requestWithCookie("r-concurrente"));
    await Promise.resolve();
    resolveRefresh(response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200));

    const [resA, resB] = await Promise.all([first, second]);

    expect(refreshCalls()).toHaveLength(1);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("refresh-nuevo");
    expect(resB.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("refresh-nuevo");
  });

  it("un segundo refresco con la cookie ya rotada hace un instante repite el resultado en vez de cerrar sesión", async () => {
    const me = buildMe();
    const platformRole = buildPlatformRole(null);
    fetchMock
      .mockResolvedValueOnce(response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200))
      .mockResolvedValueOnce(response(me, 200))
      .mockResolvedValueOnce(response(platformRole, 200))
      // Segunda llamada: el backend ya tiene ese refresh en lista negra.
      .mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    await POST(requestWithCookie("r-repetido"));
    const res = await POST(requestWithCookie("r-repetido"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ accessToken: "access-nuevo", user: me, platformRole });
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("refresh-nuevo");
    expect(cookie?.maxAge).not.toBe(0);
  });

  it("repite también el 503 con la cookie rotada cuando el perfil falló en la rotación reciente", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200))
      .mockResolvedValueOnce(response({ detail: "error" }, 502))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200))
      .mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    await POST(requestWithCookie("r-repetido-sin-perfil"));
    const res = await POST(requestWithCookie("r-repetido-sin-perfil"));

    expect(res.status).toBe(503);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("refresh-nuevo");
  });

  it("pasados más de 10 s, la rotación reciente ya no vale y el 401 cierra sesión", async () => {
    const start = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(start);
    fetchMock
      .mockResolvedValueOnce(response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200))
      .mockResolvedValueOnce(response(buildMe(), 200))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200))
      .mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    await POST(requestWithCookie("r-caducado-ttl"));
    now.mockReturnValue(start + 11_000);
    const res = await POST(requestWithCookie("r-caducado-ttl"));

    expect(res.status).toBe(401);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(0);
    now.mockRestore();
  });
});
