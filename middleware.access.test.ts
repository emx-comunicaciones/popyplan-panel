// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_COOKIE_NAME, ACCESS_TOKEN_HEADER, SESSION_COOKIE_NAME } from "@/lib/auth/cookie";

import { middleware } from "./middleware";

/**
 * Error del propietario (2026-09-30): pulsar el menú echaba al login. Con el
 * token de acceso en su cookie, el middleware no rota el refresh mientras
 * el token viva, así los prefetch del menú ya no se pisan.
 */
const fetchMock = vi.fn();

function jwt(expSecondsFromNow: number): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + expSecondsFromNow };
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.firma`;
}

function request(cookies: Record<string, string>): NextRequest {
  const req = new NextRequest("http://panel.test/plataforma/entidades", {
    headers: { "sec-fetch-dest": "empty", rsc: "1" },
  });
  for (const [name, value] of Object.entries(cookies)) req.cookies.set(name, value);
  return req;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("middleware con el token de acceso en cookie", () => {
  it("con el token vivo pasa con él y no llama al backend", async () => {
    const access = jwt(3600);
    const res = await middleware(request({ [SESSION_COOKIE_NAME]: "r1", [ACCESS_COOKIE_NAME]: access }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get(`x-middleware-request-${ACCESS_TOKEN_HEADER}`)).toBe(access);
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("diez prefetch a la vez con el token vivo no rotan nada", async () => {
    const access = jwt(3600);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        middleware(request({ [SESSION_COOKIE_NAME]: "r1", [ACCESS_COOKIE_NAME]: access })),
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(results.every((r) => r.status === 200)).toBe(true);
  });

  it("con el token a punto de caducar rota y guarda el acceso nuevo en su cookie", async () => {
    const nuevo = jwt(24 * 3600);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access: nuevo, refresh: "r2" }),
    } as Response);

    const res = await middleware(request({ [SESSION_COOKIE_NAME]: "r1", [ACCESS_COOKIE_NAME]: jwt(30) }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("r2");
    expect(res.cookies.get(ACCESS_COOKIE_NAME)?.value).toBe(nuevo);
    expect(res.cookies.get(ACCESS_COOKIE_NAME)?.httpOnly).toBe(true);
  });

  it("un token ilegible en la cookie no se usa: se rota como siempre", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access: jwt(3600), refresh: "r2" }),
    } as Response);
    await middleware(request({ [SESSION_COOKIE_NAME]: "r1", [ACCESS_COOKIE_NAME]: "basura" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
