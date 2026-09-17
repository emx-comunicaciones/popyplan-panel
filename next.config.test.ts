// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El config se importa de forma dinámica en cada test porque
 * `images.remotePatterns` se calcula al cargar el módulo: sin
 * `vi.resetModules()`, el segundo test vería los patrones del primero.
 * `headers()` sí lee el entorno en cada llamada.
 */
async function loadConfig() {
  vi.resetModules();
  return (await import("./next.config")).default;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");
  vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("next.config", () => {
  it("restringe las imágenes remotas al backend, sin el comodín `**`", async () => {
    const config = await loadConfig();

    expect(config.images?.remotePatterns).toEqual([
      { protocol: "https", hostname: "api.popyplan.com", port: "" },
    ]);
  });

  it("añade los hosts de medios declarados en el entorno", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_HOSTS", "cdn.popyplan.com");

    const config = await loadConfig();

    expect(config.images?.remotePatterns).toContainEqual({
      protocol: "https",
      hostname: "cdn.popyplan.com",
    });
  });

  it("aplica las cabeceras de seguridad a todas las rutas", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const config = await loadConfig();

    const rules = await config.headers?.();

    expect(rules).toHaveLength(1);
    expect(rules?.[0].source).toBe("/(.*)");
    expect(rules?.[0].headers).toEqual([
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ]);
  });

  it("en producción añade además HSTS", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const config = await loadConfig();

    const rules = await config.headers?.();

    expect(rules?.[0].headers).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  });
});
