import { afterEach, describe, expect, it, vi } from "vitest";

import { apiBaseUrl } from "./baseUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("apiBaseUrl", () => {
  it("devuelve la URL configurada", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com");

    expect(apiBaseUrl()).toBe("https://api.popyplan.com");
  });

  it("quita la barra final (una o varias) para no generar rutas con doble barra", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com/");
    expect(apiBaseUrl()).toBe("https://api.popyplan.com");

    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.popyplan.com///");
    expect(apiBaseUrl()).toBe("https://api.popyplan.com");
  });

  it("ignora los espacios alrededor del valor", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "  https://api.popyplan.com  ");

    expect(apiBaseUrl()).toBe("https://api.popyplan.com");
  });

  it("sin la variable, fuera de producción cae al backend local", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    vi.stubEnv("NODE_ENV", "development");

    expect(apiBaseUrl()).toBe("http://localhost:8001");
  });

  it("con la variable vacía se comporta como si no estuviera definida", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "   ");
    vi.stubEnv("NODE_ENV", "development");

    expect(apiBaseUrl()).toBe("http://localhost:8001");
  });

  it("sin la variable, en producción lanza en vez de apuntar a localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    vi.stubEnv("NODE_ENV", "production");

    expect(() => apiBaseUrl()).toThrow("NEXT_PUBLIC_API_URL no está definida");
  });
});
