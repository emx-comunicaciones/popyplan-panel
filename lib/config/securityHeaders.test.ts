import { afterEach, describe, expect, it, vi } from "vitest";

import { securityHeaders } from "./securityHeaders";

afterEach(() => {
  vi.unstubAllEnvs();
});

function valueOf(key: string): string | undefined {
  return securityHeaders().find((header) => header.key === key)?.value;
}

describe("securityHeaders", () => {
  it("fija las cuatro cabeceras base en cualquier entorno", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(valueOf("X-Content-Type-Options")).toBe("nosniff");
    expect(valueOf("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(valueOf("X-Frame-Options")).toBe("DENY");
    expect(valueOf("Permissions-Policy")).toBe("camera=(self), microphone=(), geolocation=()");
  });

  it("deja la cámara permitida en el propio origen (el escáner QR de Asistencia la usa)", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(valueOf("Permissions-Policy")).toContain("camera=(self)");
  });

  it("solo añade HSTS en producción", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(valueOf("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");

    vi.stubEnv("NODE_ENV", "development");
    expect(valueOf("Strict-Transport-Security")).toBeUndefined();

    vi.stubEnv("NODE_ENV", "test");
    expect(valueOf("Strict-Transport-Security")).toBeUndefined();
  });

  it("no declara CSP todavía (Next inyecta scripts inline; el nonce es trabajo aparte)", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(valueOf("Content-Security-Policy")).toBeUndefined();
  });

  it("no repite ninguna cabecera", () => {
    vi.stubEnv("NODE_ENV", "production");

    const keys = securityHeaders().map((header) => header.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
