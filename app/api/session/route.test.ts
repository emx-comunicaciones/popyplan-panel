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

function requestWithCookie(value: string | undefined) {
  const req = new NextRequest("http://panel.test/api/session", { method: "DELETE" });
  if (value !== undefined) {
    req.cookies.set(SESSION_COOKIE_NAME, value);
  }
  return req;
}

describe("POST /api/session", () => {
  it("login correcto: trae me + rol de plataforma y guarda el REFRESH (no el access) en la cookie httpOnly", async () => {
    const me = buildMe();
    const platformRole = buildPlatformRole(null);
    fetchMock
      .mockResolvedValueOnce(
        response({ key: "access-123", refresh: "refresh-456", user: { pk: me.id } }, 200),
      ) // login
      .mockResolvedValueOnce(response(me, 200)) // me
      .mockResolvedValueOnce(response(platformRole, 200)); // platform-roles/me

    const res = await POST(loginRequest({ username_or_email: "titular@alfaville.test", password: "correcta-1234" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ accessToken: "access-123", user: me, platformRole });
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("refresh-456");
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
      .mockResolvedValueOnce(response({ key: "access-123", refresh: "refresh-456", user: {} }, 200))
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
      .mockResolvedValueOnce(response({ key: "access-123", refresh: "refresh-456", user: {} }, 200))
      .mockResolvedValueOnce(response({ detail: "error" }, 500))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200));

    const res = await POST(loginRequest({ username_or_email: "x", password: "y" }));

    expect(res.status).toBe(502);
  });
});

describe("DELETE /api/session", () => {
  it("con refresh en la cookie, invalida el refresh en el backend (best-effort) y borra la cookie", async () => {
    fetchMock.mockResolvedValueOnce(response({}, 200));

    const res = await DELETE(requestWithCookie("refresh-789"));
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/auth/logout/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh: "refresh-789" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });

  it("sin cookie, no llama al backend y borra la cookie igualmente", async () => {
    const res = await DELETE(requestWithCookie(undefined));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(0);
  });

  it("si el logout del backend falla, borra la cookie igual (best-effort)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("red caída"));

    const res = await DELETE(requestWithCookie("refresh-789"));

    expect(res.status).toBe(200);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(0);
  });
});
