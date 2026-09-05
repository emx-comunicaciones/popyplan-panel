// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie";

import { DELETE, POST } from "./route";

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

function loginRequest(body: unknown) {
  return new NextRequest("http://panel.test/api/session", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/session", () => {
  it("login correcto: trae me + rol de plataforma y pone la cookie httpOnly", async () => {
    const me = buildMe();
    const platformRole = buildPlatformRole(null);
    fetchMock
      .mockResolvedValueOnce(response({ key: "token-123", user: { pk: me.id } }, 200)) // login
      .mockResolvedValueOnce(response(me, 200)) // me
      .mockResolvedValueOnce(response(platformRole, 200)); // platform-roles/me

    const res = await POST(loginRequest({ username_or_email: "titular@alfaville.test", password: "correcta-1234" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ accessToken: "token-123", user: me, platformRole });
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("token-123");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("strict");
  });

  it("body incompleto responde 400 sin llamar al backend", async () => {
    const res = await POST(loginRequest({ username_or_email: "titular@alfaville.test" }));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("credenciales incorrectas: reenvía el 400 del backend tal cual", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "Credenciales inválidas" }, 400));

    const res = await POST(loginRequest({ username_or_email: "x", password: "mala" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ detail: "Credenciales inválidas" });
  });

  it("login rechazado sin cuerpo JSON parseable usa el detalle por defecto", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => {
        throw new Error("no es JSON");
      },
      text: async () => "",
    } as unknown as Response);

    const res = await POST(loginRequest({ username_or_email: "x", password: "y" }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ detail: "No se pudo iniciar sesión." });
  });

  it("sin NEXT_PUBLIC_API_URL llama al backend local por defecto", async () => {
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_API_URL;
    fetchMock
      .mockResolvedValueOnce(response({ key: "token-123", user: {} }, 200))
      .mockResolvedValueOnce(response(buildMe(), 200))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200));

    await POST(loginRequest({ username_or_email: "x", password: "y" }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8001/api/auth/login/",
      expect.anything(),
    );
  });

  it("si el login sale bien pero /me falla, responde 502", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ key: "token-123", user: {} }, 200))
      .mockResolvedValueOnce(response({ detail: "error" }, 500))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200));

    const res = await POST(loginRequest({ username_or_email: "x", password: "y" }));

    expect(res.status).toBe(502);
  });
});

describe("DELETE /api/session", () => {
  it("borra la cookie de sesión", async () => {
    const res = await DELETE();
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);

    expect(res.status).toBe(200);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});
