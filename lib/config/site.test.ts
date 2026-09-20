import { afterEach, describe, expect, it, vi } from "vitest";

import { contactEmail, siteUrl, storeLinks } from "./site";

afterEach(() => {
  vi.unstubAllEnvs();
});

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
});
