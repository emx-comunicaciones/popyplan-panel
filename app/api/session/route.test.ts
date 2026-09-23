// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie";
import { LANG_COOKIE_NAME } from "@/lib/i18n/cookie";

import { clearRecentRotations } from "@/lib/auth/rotationCache";

import { POST as REFRESH } from "./refresh/route";
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

function loginRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest("http://panel.test/api/session", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
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

  it("reenvía al backend la IP real del cliente (el rate limit por IP del login es compartido)", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ key: "access-123", refresh: "refresh-456", user: {} }, 200))
      .mockResolvedValueOnce(response(buildMe(), 200))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200));

    await POST(
      loginRequest(
        { username_or_email: "x", password: "y" },
        { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
      ),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://api.test/api/auth/login/",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Forwarded-For": "203.0.113.7" }),
      }),
    );
  });

  it("reenvía la cookie pp_lang de quien inicia sesión como Accept-Language del login", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ key: "access-123", refresh: "refresh-456", user: {} }, 200))
      .mockResolvedValueOnce(response(buildMe(), 200))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200));

    const req = loginRequest({ username_or_email: "x", password: "y" });
    req.cookies.set(LANG_COOKIE_NAME, "ca");
    await POST(req);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://api.test/api/auth/login/",
      expect.objectContaining({
        headers: expect.objectContaining({ "Accept-Language": "ca" }),
      }),
    );
  });

  it("sin cookie pp_lang, el login cae a Accept-Language del navegador", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ key: "access-123", refresh: "refresh-456", user: {} }, 200))
      .mockResolvedValueOnce(response(buildMe(), 200))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200));

    await POST(
      loginRequest(
        { username_or_email: "x", password: "y" },
        { "accept-language": "eu-ES,eu;q=0.9" },
      ),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://api.test/api/auth/login/",
      expect.objectContaining({
        headers: expect.objectContaining({ "Accept-Language": "eu" }),
      }),
    );
  });

  it("si el login responde 200 con un cuerpo ilegible, responde 502 sin fijar la cookie", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("no es JSON");
      },
      text: async () => "",
    } as unknown as Response);

    const res = await POST(loginRequest({ username_or_email: "x", password: "y" }));
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data).toEqual({ detail: "Respuesta inesperada del servidor de autenticación." });
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("si el login responde 200 sin refresh, responde 502 sin fijar la cookie", async () => {
    fetchMock.mockResolvedValueOnce(response({ key: "access-123", user: {} }, 200));

    const res = await POST(loginRequest({ username_or_email: "x", password: "y" }));

    expect(res.status).toBe(502);
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it("el logout también reenvía la IP real del cliente (misma clave de rate limit que el login)", async () => {
    fetchMock.mockResolvedValueOnce(response({}, 200));

    const req = new NextRequest("http://panel.test/api/session", {
      method: "DELETE",
      headers: { "x-real-ip": "198.51.100.4" },
    });
    req.cookies.set(SESSION_COOKIE_NAME, "refresh-789");
    await DELETE(req);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/auth/logout/",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Forwarded-For": "198.51.100.4" }),
      }),
    );
  });

  it("el logout reenvía la cookie pp_lang como Accept-Language", async () => {
    fetchMock.mockResolvedValueOnce(response({}, 200));

    const req = requestWithCookie("refresh-789");
    req.cookies.set(LANG_COOKIE_NAME, "eu");
    await DELETE(req);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/auth/logout/",
      expect.objectContaining({
        headers: expect.objectContaining({ "Accept-Language": "eu" }),
      }),
    );
  });

  it("sin cookie, no llama al backend y borra la cookie igualmente", async () => {
    const res = await DELETE(requestWithCookie(undefined));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(0);
  });

  it("el logout olvida las rotaciones recientes: el refresh anterior ya no devuelve un access vivo", async () => {
    clearRecentRotations();
    const refreshRequest = () => {
      const req = new NextRequest("http://panel.test/api/session/refresh", { method: "POST" });
      req.cookies.set(SESSION_COOKIE_NAME, "r-logout");
      return req;
    };
    fetchMock
      // Refresco inicial: rota r-logout y guarda el resultado.
      .mockResolvedValueOnce(response({ access: "access-vivo", refresh: "refresh-nuevo" }, 200))
      .mockResolvedValueOnce(response(buildMe(), 200))
      .mockResolvedValueOnce(response(buildPlatformRole(null), 200))
      // Logout.
      .mockResolvedValueOnce(response({}, 200))
      // Segundo refresco con la cookie vieja: el backend la tiene en lista negra.
      .mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    expect((await REFRESH(refreshRequest())).status).toBe(200);
    await DELETE(requestWithCookie("refresh-nuevo"));
    const res = await REFRESH(refreshRequest());

    expect(res.status).toBe(401);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(0);
  });

  it("si el logout del backend falla, borra la cookie igual (best-effort)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("red caída"));

    const res = await DELETE(requestWithCookie("refresh-789"));

    expect(res.status).toBe(200);
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(0);
  });
});

describe("POST /api/session · idioma de la cuenta (fix 2026-09-23)", () => {
  it("fija `pp_lang` con el idioma de la cuenta en la misma respuesta del login", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/auth/login/")) {
        return response({ key: "acceso", refresh: "refresco", user: {} }, 200);
      }
      if (String(url).includes("/users/me/")) {
        return response({ ...buildMe(), preferred_language: "eu" }, 200);
      }
      return response(buildPlatformRole(), 200);
    });

    const res = await POST(loginRequest({ username_or_email: "a@b.c", password: "x" }));

    expect(res.status).toBe(200);
    expect(res.cookies.get(LANG_COOKIE_NAME)?.value).toBe("eu");
  });

  it("una cuenta sin idioma guardado no toca la cookie", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/auth/login/")) {
        return response({ key: "acceso", refresh: "refresco", user: {} }, 200);
      }
      if (String(url).includes("/users/me/")) {
        return response({ ...buildMe(), preferred_language: "" }, 200);
      }
      return response(buildPlatformRole(), 200);
    });

    const res = await POST(loginRequest({ username_or_email: "a@b.c", password: "x" }));

    expect(res.cookies.get(LANG_COOKIE_NAME)).toBeUndefined();
  });
});
