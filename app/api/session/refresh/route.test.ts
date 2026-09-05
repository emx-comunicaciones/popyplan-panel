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

function requestWithCookie(value: string | undefined) {
  const req = new NextRequest("http://panel.test/api/session/refresh", { method: "POST" });
  if (value !== undefined) {
    req.cookies.set(SESSION_COOKIE_NAME, value);
  }
  return req;
}

describe("POST /api/session/refresh", () => {
  it("sin cookie responde 401", async () => {
    const res = await POST(requestWithCookie(undefined));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con cookie válida devuelve el mismo token y datos frescos", async () => {
    const me = buildMe();
    const platformRole = buildPlatformRole(null);
    fetchMock
      .mockResolvedValueOnce(response(me, 200))
      .mockResolvedValueOnce(response(platformRole, 200));

    const res = await POST(requestWithCookie("token-vivo"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ accessToken: "token-vivo", user: me, platformRole });
  });

  it("con cookie caducada (401 del backend) la borra y responde 401", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ detail: "expirado" }, 401))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200));

    const res = await POST(requestWithCookie("token-caducado"));

    expect(res.status).toBe(401);
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});
