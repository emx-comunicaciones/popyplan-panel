// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_HEADER, SESSION_COOKIE_NAME } from "@/lib/auth/cookie";

import { middleware } from "./middleware";

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
  } as Response;
}

function requestWithCookie(value: string | undefined, headers?: Record<string, string>) {
  const req = new NextRequest("http://panel.test/entidad/alfaville", { headers });
  if (value !== undefined) {
    req.cookies.set(SESSION_COOKIE_NAME, value);
  }
  return req;
}

describe("middleware", () => {
  it("sin cookie de sesión, deja pasar sin llamar al backend ni poner cabecera", async () => {
    const res = await middleware(requestWithCookie(undefined));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.get(ACCESS_TOKEN_HEADER)).toBeNull();
  });

  it("con refresh válido: rota el token, guarda el refresh nuevo en la cookie y reenvía el access como cabecera", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200),
    );

    const res = await middleware(requestWithCookie("refresh-viejo"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/auth/token/refresh/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh: "refresh-viejo" }),
      }),
    );
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("refresh-nuevo");
    expect(res.headers.get("x-middleware-request-" + ACCESS_TOKEN_HEADER)).toBe("access-nuevo");
  });

  it("con refresh caducado/en lista negra, borra la cookie y deja pasar sin cabecera", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    const res = await middleware(requestWithCookie("refresh-caducado"));

    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("");
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(0);
  });

  it("401 en navegación de documento (sec-fetch-dest: document) borra la cookie", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    const res = await middleware(
      requestWithCookie("refresh-caducado", { "sec-fetch-dest": "document" }),
    );

    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(0);
  });

  it("401 en prefetch/RSC (sec-fetch-dest distinto de document) NO toca la cookie", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    const res = await middleware(requestWithCookie("refresh-caducado", { "sec-fetch-dest": "empty" }));

    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("dos peticiones concurrentes con la misma cookie disparan UNA sola llamada al backend", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = middleware(requestWithCookie("refresh-viejo"));
    const second = middleware(requestWithCookie("refresh-viejo"));
    await Promise.resolve();
    resolveFetch(response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200));

    const [resA, resB] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resA.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("refresh-nuevo");
    expect(resB.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("refresh-nuevo");
  });

  it("si la llamada de refresco falla en red, responde 503 sin tocar la cookie", async () => {
    fetchMock.mockRejectedValueOnce(new Error("red caída"));

    const res = await middleware(requestWithCookie("refresh-viejo"));

    expect(res.status).toBe(503);
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });
});
