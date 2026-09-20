import { afterEach, describe, expect, it, vi } from "vitest";

import { contactEmail, siteUrl, storeLinks } from "./site";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/**
 * El aviso de `siteUrl()` se emite **una sola vez por proceso** (bandera
 * a nivel de módulo, hallazgo I2), así que cada test que lo observa
 * necesita un módulo recién cargado: `vi.resetModules()` + `import()`
 * dinámico, en vez del import estático que usan los demás.
 */
async function freshSite(): Promise<typeof import("./site")> {
  vi.resetModules();
  return import("./site");
}

describe("siteUrl", () => {
  it("devuelve la URL configurada", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com");

    expect(siteUrl()).toBe("https://popyplan.com");
  });

  it("quita la barra final (una o varias) para no generar URLs con doble barra", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com/");
    expect(siteUrl()).toBe("https://popyplan.com");

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com///");
    expect(siteUrl()).toBe("https://popyplan.com");
  });

  it("ignora los espacios alrededor del valor", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "  https://popyplan.com  ");

    expect(siteUrl()).toBe("https://popyplan.com");
  });

  it("sin la variable cae al panel local (puerto 3100, el de los e2e)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);

    expect(siteUrl()).toBe("http://localhost:3100");
  });

  it("con la variable vacía se comporta como si no estuviera definida", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "   ");

    expect(siteUrl()).toBe("http://localhost:3100");
  });

  it("un host sin esquema no es una URL absoluta: cae al valor por defecto", () => {
    // `new URL("popyplan.com")` lanza; devolverlo tal cual tumbaba
    // `generateMetadata` de la landing en cada petición (hallazgo I1).
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "popyplan.com");

    expect(siteUrl()).toBe("http://localhost:3100");
  });

  it("un esquema solo, sin host, cae al valor por defecto", () => {
    // Tras quitar las barras finales queda `https:`, que tampoco parsea.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://");

    expect(siteUrl()).toBe("http://localhost:3100");
  });

  it("un esquema que no es http(s) cae al valor por defecto", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "ftp://popyplan.com");
    expect(siteUrl()).toBe("http://localhost:3100");

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "javascript:alert(1)");
    expect(siteUrl()).toBe("http://localhost:3100");
  });

  it("acepta http, no solo https (el panel local y los entornos internos)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://panel.interno:8080");

    expect(siteUrl()).toBe("http://panel.interno:8080");
  });

  it("en producción avisa una sola vez si la variable no está declarada", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const site = await freshSite();

    expect(site.siteUrl()).toBe("http://localhost:3100");
    site.siteUrl();
    site.siteUrl();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("en producción avisa también cuando el valor no es una URL absoluta", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "popyplan.com");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const site = await freshSite();

    expect(site.siteUrl()).toBe("http://localhost:3100");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("popyplan.com");
  });

  it("fuera de producción no avisa (el valor por defecto es el correcto en local)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const site = await freshSite();

    expect(site.siteUrl()).toBe("http://localhost:3100");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "popyplan.com");
    expect(site.siteUrl()).toBe("http://localhost:3100");

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("contactEmail", () => {
  it("devuelve el correo configurado", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "entidades@popyplan.com");

    expect(contactEmail()).toBe("entidades@popyplan.com");
  });

  it("sin la variable usa el correo por defecto", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", undefined);

    expect(contactEmail()).toBe("hola@popyplan.com");
  });

  it("con la variable vacía usa el correo por defecto", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "  ");

    expect(contactEmail()).toBe("hola@popyplan.com");
  });

  it("un valor que no parece un correo usa el correo por defecto", () => {
    // Sin arroba, sin punto tras el dominio, con espacios en medio o con
    // parámetros de cabecera pegados: ninguno puede acabar en un `href`
    // de `mailto:` (hallazgo M9).
    for (const invalid of [
      "hola",
      "hola@popyplan",
      "hola popyplan.com",
      "hola@popyplan.com&cc=alguien@otro.com",
      "@popyplan.com",
    ]) {
      vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", invalid);
      expect(contactEmail()).toBe("hola@popyplan.com");
    }
  });
});

describe("storeLinks", () => {
  it("devuelve las dos fichas configuradas", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/popyplan/id1");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "https://play.google.com/store/apps/details?id=com.popyplan");

    expect(storeLinks()).toEqual({
      appStore: "https://apps.apple.com/app/popyplan/id1",
      playStore: "https://play.google.com/store/apps/details?id=com.popyplan",
    });
  });

  it("una tienda ausente o vacía es null (su botón no se pinta)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "   ");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", undefined);

    expect(storeLinks()).toEqual({ appStore: null, playStore: null });
  });

  it("recorta los espacios alrededor de cada URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "  https://apps.apple.com/app/popyplan/id1  ");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", undefined);

    expect(storeLinks().appStore).toBe("https://apps.apple.com/app/popyplan/id1");
  });

  it("una URL que no es https es null (acaba directamente en un href)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "http://apps.apple.com/app/popyplan/id1");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "javascript:alert(1)");

    expect(storeLinks()).toEqual({ appStore: null, playStore: null });
  });

  it("un valor que ni siquiera parsea como URL es null", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "apps.apple.com/app/popyplan/id1");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "no soy una url");

    expect(storeLinks()).toEqual({ appStore: null, playStore: null });
  });
});
