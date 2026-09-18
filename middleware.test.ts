// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_HEADER, SESSION_COOKIE_NAME } from "@/lib/auth/cookie";

import { config, middleware } from "./middleware";

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

function requestWithCookie(
  value: string | undefined,
  headers?: Record<string, string>,
  url = "http://panel.test/entidad/alfaville",
) {
  const req = new NextRequest(url, { headers });
  if (value !== undefined) {
    req.cookies.set(SESSION_COOKIE_NAME, value);
  }
  return req;
}

/**
 * Nombres de las cabeceras que el middleware reenvía a la petición
 * (`NextResponse.next({ request: { headers } })`): Next las lista en
 * `x-middleware-override-headers` y esa lista es la autoritativa — si no
 * hay lista, la petición original pasa tal cual (cabecera forjada
 * incluida), por eso el test exige que la lista exista.
 */
function forwardedHeaderNames(res: Response): string[] {
  const overridden = res.headers.get("x-middleware-override-headers");
  return overridden === null ? [] : overridden.split(",");
}

describe("middleware", () => {
  it("el matcher cubre la raíz y las tres áreas del panel", () => {
    expect(config.matcher).toEqual([
      "/",
      "/entidad/:path*",
      "/paraguas/:path*",
      "/plataforma/:path*",
      "/elegir-entidad",
    ]);
  });

  it("sin cookie de sesión, redirige al login con el destino y sin llamar al backend", async () => {
    const res = await middleware(requestWithCookie(undefined));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://panel.test/login?returnTo=%2Fentidad%2Falfaville",
    );
  });

  it("sin cookie en la raíz, redirige al login sin returnTo", async () => {
    const res = await middleware(requestWithCookie(undefined, undefined, "http://panel.test/"));

    expect(res.headers.get("location")).toBe("http://panel.test/login");
  });

  it("el returnTo conserva la cadena de consulta del destino", async () => {
    const res = await middleware(
      requestWithCookie(undefined, undefined, "http://panel.test/entidad/alfaville/personas?page=3"),
    );

    expect(res.headers.get("location")).toBe(
      "http://panel.test/login?returnTo=%2Fentidad%2Falfaville%2Fpersonas%3Fpage%3D3",
    );
  });

  it("sin cookie en un prefetch/RSC deja pasar y BORRA la cabecera interna que trajera el cliente", async () => {
    const res = await middleware(
      requestWithCookie(undefined, {
        "sec-fetch-dest": "empty",
        [ACCESS_TOKEN_HEADER]: "access-falsificado",
      }),
    );

    expect(res.status).toBe(200);
    expect(forwardedHeaderNames(res)).not.toHaveLength(0);
    expect(forwardedHeaderNames(res)).not.toContain(ACCESS_TOKEN_HEADER);
    expect(res.headers.get(`x-middleware-request-${ACCESS_TOKEN_HEADER}`)).toBeNull();
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

  it("reenvía al backend la IP real del cliente (rate limit por IP compartido con el login)", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200),
    );

    await middleware(
      requestWithCookie("refresh-viejo", { "x-forwarded-for": "203.0.113.7, 70.41.3.18" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/auth/token/refresh/",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Forwarded-For": "203.0.113.7" }),
      }),
    );
  });

  it("con refresh caducado/en lista negra redirige al login con el destino, sin tocar la cookie", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    const res = await middleware(requestWithCookie("refresh-caducado"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://panel.test/login?returnTo=%2Fentidad%2Falfaville",
    );
    // Hallazgo F3: el middleware (Edge) no comparte `rotationCache` con
    // `/api/session/refresh` (Node), así que su 401 puede ser el de un
    // refresh que otro proceso acaba de rotar con éxito — borrar la cookie
    // aquí destruía una sesión sana. El borrado lo hace el route handler,
    // que sí tiene la caché de replay, o el logout.
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("401 en navegación de documento (sec-fetch-dest: document) tampoco borra la cookie", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    const res = await middleware(
      requestWithCookie("refresh-caducado", { "sec-fetch-dest": "document" }),
    );

    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("401 en prefetch/RSC (sec-fetch-dest distinto de document) NO toca la cookie ni reenvía la cabecera interna", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    const res = await middleware(
      requestWithCookie("refresh-caducado", {
        "sec-fetch-dest": "empty",
        [ACCESS_TOKEN_HEADER]: "access-falsificado",
      }),
    );

    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
    expect(forwardedHeaderNames(res)).not.toHaveLength(0);
    expect(forwardedHeaderNames(res)).not.toContain(ACCESS_TOKEN_HEADER);
    expect(res.headers.get(`x-middleware-request-${ACCESS_TOKEN_HEADER}`)).toBeNull();
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

  it("con refresh válido, reenvía el access del backend y descarta el que trajera el cliente", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200),
    );

    const res = await middleware(
      requestWithCookie("refresh-b2", { [ACCESS_TOKEN_HEADER]: "access-falsificado" }),
    );

    expect(forwardedHeaderNames(res)).toContain(ACCESS_TOKEN_HEADER);
    expect(res.headers.get(`x-middleware-request-${ACCESS_TOKEN_HEADER}`)).toBe("access-nuevo");
  });

  it("si el backend responde algo que no es JSON, lo trata como refresco fallido", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("no es JSON");
      },
    } as unknown as Response);

    const res = await middleware(requestWithCookie("refresh-viejo"));

    expect(res.status).toBe(503);
  });

  it("si el backend responde 200 sin access/refresh, NUNCA fija la cookie ni la cabecera", async () => {
    fetchMock.mockResolvedValueOnce(response({}, 200));

    const res = await middleware(requestWithCookie("refresh-incompleto"));

    expect(res.status).toBe(503);
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
    expect(res.headers.get(`x-middleware-request-${ACCESS_TOKEN_HEADER}`)).toBeNull();
  });

  it("si el backend responde 200 con solo uno de los dos tokens, tampoco pasa", async () => {
    fetchMock.mockResolvedValueOnce(response({ access: "solo-access" }, 200));

    const res = await middleware(requestWithCookie("refresh-a-medias"));

    expect(res.status).toBe(503);
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });
});
