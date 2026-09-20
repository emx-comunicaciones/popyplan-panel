import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "./robots";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots", () => {
  it("permite la web pública y prohíbe todo el panel", () => {
    const { rules } = robots();
    const rule = Array.isArray(rules) ? rules[0] : rules;

    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toEqual(["/", "/accesibilidad"]);
    expect(rule.disallow).toEqual([
      "/entidad",
      "/paraguas",
      "/plataforma",
      "/elegir-entidad",
      "/login",
      "/api",
    ]);
  });

  it("apunta el sitemap a la URL configurada del sitio", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com");

    expect(robots().sitemap).toBe("https://popyplan.com/sitemap.xml");
  });

  it("sin la variable del sitio cae al panel local", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);

    expect(robots().sitemap).toBe("http://localhost:3100/sitemap.xml");
  });
});
