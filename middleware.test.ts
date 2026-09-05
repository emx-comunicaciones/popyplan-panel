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

function requestWithCookie(value: string | undefined) {
  const req = new NextRequest("http://panel.test/entidad/alfaville");
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

  it("si la llamada de refresco falla en red, deja pasar sin tocar la cookie", async () => {
    fetchMock.mockRejectedValueOnce(new Error("red caída"));

    const res = await middleware(requestWithCookie("refresh-viejo"));

    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });
});
