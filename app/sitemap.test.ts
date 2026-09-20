import { afterEach, describe, expect, it, vi } from "vitest";

import sitemap from "./sitemap";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap", () => {
  it("lista solo las dos rutas públicas, con la URL configurada del sitio", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com");

    expect(sitemap()).toEqual([
      { url: "https://popyplan.com/", changeFrequency: "monthly", priority: 1 },
      { url: "https://popyplan.com/accesibilidad", changeFrequency: "yearly", priority: 0.3 },
    ]);
  });

  it("sin la variable del sitio cae al panel local", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);

    expect(sitemap().map((entry) => entry.url)).toEqual([
      "http://localhost:3100/",
      "http://localhost:3100/accesibilidad",
    ]);
  });
});
