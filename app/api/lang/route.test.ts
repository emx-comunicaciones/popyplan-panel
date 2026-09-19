// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { LANG_COOKIE_NAME } from "@/lib/i18n/cookie";

import { POST } from "./route";

function langRequest(body: unknown) {
  return new NextRequest("http://panel.test/api/lang", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/lang", () => {
  it("con un idioma soportado, fija la cookie pp_lang y responde 204", async () => {
    const res = await POST(langRequest({ lang: "ca" }));

    expect(res.status).toBe(204);
    expect(res.cookies.get(LANG_COOKIE_NAME)?.value).toBe("ca");
  });

  it("la cookie no es httpOnly, path raíz y un año de vida", async () => {
    const res = await POST(langRequest({ lang: "eu" }));

    const cookie = res.cookies.get(LANG_COOKIE_NAME);
    expect(cookie?.httpOnly).toBe(false);
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 365);
  });

  it("con un idioma no soportado responde 400 con detail, sin fijar cookie", async () => {
    const res = await POST(langRequest({ lang: "xx" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ detail: "Idioma no soportado." });
    expect(res.cookies.get(LANG_COOKIE_NAME)).toBeUndefined();
  });

  it("sin campo lang responde 400", async () => {
    const res = await POST(langRequest({}));

    expect(res.status).toBe(400);
  });

  it("con lang que no es una cadena responde 400", async () => {
    const res = await POST(langRequest({ lang: 3 }));

    expect(res.status).toBe(400);
  });

  it("con un cuerpo no JSON responde 400 en vez de reventar", async () => {
    const req = new NextRequest("http://panel.test/api/lang", {
      method: "POST",
      body: "no soy json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("acepta es y eu igual que ca", async () => {
    expect((await POST(langRequest({ lang: "es" }))).status).toBe(204);
    expect((await POST(langRequest({ lang: "eu" }))).status).toBe(204);
  });
});
