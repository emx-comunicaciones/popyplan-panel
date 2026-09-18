import { afterEach, describe, expect, it, vi } from "vitest";

import { imageRemotePatterns, isAllowedImageSrc } from "./imagePatterns";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("imageRemotePatterns", () => {
  it("deriva el patrón del backend configurado (protocolo, host y puerto exactos)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8001");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);

    expect(imageRemotePatterns()).toEqual([
      { protocol: "http", hostname: "localhost", port: "8001" },
    ]);
  });

  it("un backend https sin puerto explícito deja el puerto vacío", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com/");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);

    expect(imageRemotePatterns()).toEqual([
      { protocol: "https", hostname: "api.popyplan.com", port: "" },
    ]);
  });

  it("sin NEXT_PUBLIC_API_URL cae al backend local (el build sin variable no debe romper)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);

    expect(imageRemotePatterns()).toEqual([
      { protocol: "http", hostname: "localhost", port: "8001" },
    ]);
  });

  it("con una NEXT_PUBLIC_API_URL ilegible cae al backend local en vez de lanzar", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "esto-no-es-una-url");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);

    expect(imageRemotePatterns()).toEqual([
      { protocol: "http", hostname: "localhost", port: "8001" },
    ]);
  });

  it("nunca devuelve el comodín `**`", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", "cdn.popyplan.com");

    const hostnames = imageRemotePatterns().map((pattern) => pattern.hostname);

    expect(hostnames).not.toContain("**");
  });

  it("suma los hosts de NEXT_PUBLIC_MEDIA_HOSTS como https", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", "cdn.popyplan.com, media.popyplan.com");

    expect(imageRemotePatterns()).toEqual([
      { protocol: "https", hostname: "api.popyplan.com", port: "" },
      { protocol: "https", hostname: "cdn.popyplan.com" },
      { protocol: "https", hostname: "media.popyplan.com" },
    ]);
  });

  it("tolera que un host de la lista venga con esquema, ruta o espacios", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", " https://cdn.popyplan.com/media/ ,, http://otro.example ");

    expect(imageRemotePatterns()).toEqual([
      { protocol: "https", hostname: "api.popyplan.com", port: "" },
      { protocol: "https", hostname: "cdn.popyplan.com" },
      { protocol: "https", hostname: "otro.example" },
    ]);
  });

  it("no repite el host del backend si también aparece en la lista de medios", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", "api.popyplan.com,api.popyplan.com");

    expect(imageRemotePatterns()).toEqual([
      { protocol: "https", hostname: "api.popyplan.com", port: "" },
    ]);
  });

  it("una lista de medios vacía no añade patrones", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", "  ,  ");

    expect(imageRemotePatterns()).toHaveLength(1);
  });
});

describe("isAllowedImageSrc", () => {
  it("una ruta relativa siempre se permite (la sirve el propio panel)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);

    expect(isAllowedImageSrc("/logo.png")).toBe(true);
    expect(isAllowedImageSrc("/media/logos/a.png?v=2")).toBe(true);
  });

  it("permite el host del backend configurado", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8001");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);

    expect(isAllowedImageSrc("http://localhost:8001/media/logo.png")).toBe(true);
  });

  it("rechaza el mismo host en otro puerto y en otro protocolo", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8001");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);

    expect(isAllowedImageSrc("http://localhost:9999/media/logo.png")).toBe(false);
    expect(isAllowedImageSrc("https://localhost:8001/media/logo.png")).toBe(false);
  });

  it("permite un host de NEXT_PUBLIC_MEDIA_HOSTS (siempre https, cualquier puerto)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", "cdn.popyplan.com");

    expect(isAllowedImageSrc("https://cdn.popyplan.com/logos/a.png")).toBe(true);
    expect(isAllowedImageSrc("http://cdn.popyplan.com/logos/a.png")).toBe(false);
  });

  it("rechaza un host ajeno (es lo que tumbaba el layout entero)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);

    expect(isAllowedImageSrc("https://evil.example.com/logo.png")).toBe(false);
  });

  it("rechaza una cadena vacía o ilegible sin lanzar", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);

    expect(isAllowedImageSrc("")).toBe(false);
    expect(isAllowedImageSrc("   ")).toBe(false);
    expect(isAllowedImageSrc("no-es-una-url")).toBe(false);
    expect(isAllowedImageSrc("data:image/png;base64,AAAA")).toBe(false);
    expect(isAllowedImageSrc("//cdn.popyplan.com/logo.png")).toBe(false);
  });

  it("el hostname no distingue mayúsculas", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://API.popyplan.com");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);

    expect(isAllowedImageSrc("https://api.popyplan.com/logo.png")).toBe(true);
  });
});
