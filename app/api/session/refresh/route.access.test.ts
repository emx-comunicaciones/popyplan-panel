// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { ACCESS_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth/cookie";
import { clearRecentRotations } from "@/lib/auth/rotationCache";

import { POST } from "./route";

/** Con el token de acceso vivo, la restauración de arranque no rota. */
const fetchMock = vi.fn();
const REFRESH_URL = "http://api.test/api/auth/token/refresh/";

function jwt(expSecondsFromNow: number): string {
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${b64({})}.${b64({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.x`;
}

function response(body: unknown, status: number): Response {
  return { ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function req(cookies: Record<string, string>): NextRequest {
  const r = new NextRequest("http://panel.test/api/session/refresh", { method: "POST" });
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearRecentRotations();
});

describe("POST /api/session/refresh con el token de acceso en cookie", () => {
  it("con el token vivo devuelve el perfil sin rotar el refresh", async () => {
    const access = jwt(3600);
    const me = buildMe();
    const platformRole = buildPlatformRole(null);
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("platform-role") || String(url).includes("platform_role") || String(url).includes("roles/me")
        ? response(platformRole, 200)
        : response(me, 200),
    );

    const res = await POST(req({ [SESSION_COOKIE_NAME]: "r1", [ACCESS_COOKIE_NAME]: access }));

    expect(res.status).toBe(200);
    expect((await res.json()).accessToken).toBe(access);
    expect(fetchMock.mock.calls.filter((c) => c[0] === REFRESH_URL)).toHaveLength(0);
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("si el backend no acepta el token vivo, rota como siempre y guarda el acceso nuevo", async () => {
    const nuevo = jwt(24 * 3600);
    fetchMock.mockImplementation(async (url: string, init?: { headers?: Record<string, string> }) => {
      if (url === REFRESH_URL) return response({ access: nuevo, refresh: "r2" }, 200);
      const auth = init?.headers?.Authorization ?? "";
      return auth.includes(nuevo) ? response(buildMe(), 200) : response({ detail: "no" }, 401);
    });

    const res = await POST(req({ [SESSION_COOKIE_NAME]: "r1", [ACCESS_COOKIE_NAME]: jwt(3600) }));

    expect(fetchMock.mock.calls.filter((c) => c[0] === REFRESH_URL)).toHaveLength(1);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("r2");
    expect(res.cookies.get(ACCESS_COOKIE_NAME)?.value).toBe(nuevo);
  });
});
