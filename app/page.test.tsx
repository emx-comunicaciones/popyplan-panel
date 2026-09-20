import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import Home, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  vi.unstubAllEnvs();
});

async function renderHomeExpectingRedirect(): Promise<string> {
  try {
    await Home();
    throw new Error("se esperaba un redirect");
  } catch (error) {
    if (error instanceof NextRedirectSignal) return error.url;
    throw error;
  }
}

describe("Home (app/page.tsx)", () => {
  it("sin sesión la landing no tiene violaciones de accesibilidad (axe)", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { container } = render(await Home());

    expect(await axe(container)).toHaveNoViolations();
  });

  it("sin sesión pinta la landing con su portada y las cuatro tarjetas de público", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Planes, comunidades y actividades para vivir bien acompañado",
      }),
    ).toBeInTheDocument();
    for (const name of [
      "Personas",
      "Asociaciones y ONG",
      "Administraciones públicas",
      "Profesionales",
    ]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
  });

  it("sin sesión ofrece entrar al panel desde la cabecera", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it("la llamada de contacto es un mailto al correo por defecto, con su asunto", async () => {
    getServerSessionMock.mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", undefined);

    render(await Home());

    expect(screen.getByRole("link", { name: "Escríbenos" })).toHaveAttribute(
      "href",
      "mailto:hola@popyplan.com?subject=Consulta%20sobre%20Popyplan",
    );
    expect(screen.getByRole("link", { name: "Escríbenos para una asociación" })).toHaveAttribute(
      "href",
      "mailto:hola@popyplan.com?subject=Popyplan%20para%20una%20asociaci%C3%B3n",
    );
  });

  it("sin tiendas configuradas la landing no pinta botones de tienda", async () => {
    getServerSessionMock.mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", undefined);

    render(await Home());

    expect(screen.queryByRole("link", { name: "Descargar en el App Store" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Descargar en Google Play" })).toBeNull();
  });

  it("sin sesión, con tiendas configuradas, la portada enseña los botones de App Store y Google Play", async () => {
    getServerSessionMock.mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/popyplan/id1");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "https://play.google.com/store/apps/details?id=com.popyplan");

    render(await Home());

    // `<StoreLinks />` se monta dos veces en la landing (el hero y la
    // tarjeta de «Personas»), así que hay dos enlaces con el mismo nombre
    // accesible — `getAllByRole` en vez de `getByRole`, comprobando que
    // los dos llevan la URL correcta.
    const appStoreLinks = screen.getAllByRole("link", { name: "Descargar en el App Store" });
    expect(appStoreLinks).toHaveLength(2);
    for (const link of appStoreLinks) {
      expect(link).toHaveAttribute("href", "https://apps.apple.com/app/popyplan/id1");
    }

    const playStoreLinks = screen.getAllByRole("link", { name: "Descargar en Google Play" });
    expect(playStoreLinks).toHaveLength(2);
    for (const link of playStoreLinks) {
      expect(link).toHaveAttribute(
        "href",
        "https://play.google.com/store/apps/details?id=com.popyplan",
      );
    }
  });

  it("generateMetadata describe la landing con su Open Graph", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com");

    const metadata = await generateMetadata();

    expect(metadata.title).toEqual({
      absolute: "Popyplan — planes, comunidades y actividades",
    });
    expect(metadata.description).toBe(
      "Popyplan es la app de planes, comunidades y actividades, con un panel para asociaciones, administraciones públicas y profesionales.",
    );
    expect(metadata.openGraph).toMatchObject({
      title: "Popyplan — planes, comunidades y actividades",
      url: "https://popyplan.com",
      siteName: "Popyplan",
      images: ["/og.png"],
      locale: "es_ES",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("generateMetadata fija metadataBase al host real, para que las imágenes relativas de Open Graph resuelvan", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com");

    const metadata = await generateMetadata();

    expect(metadata.metadataBase?.href).toBe("https://popyplan.com/");
  });

  it("con un NEXT_PUBLIC_SITE_URL mal escrito no lanza: cae al valor por defecto", async () => {
    // `new URL("popyplan.com")` lanza, y `generateMetadata` corre en cada
    // petición de `/` (ruta dinámica): sin la validación de `siteUrl()`
    // esto era un 500 para todo visitante anónimo (hallazgo I1).
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "popyplan.com");

    const metadata = await generateMetadata();

    expect(metadata.metadataBase?.href).toBe("http://localhost:3100/");
    expect(metadata.openGraph).toMatchObject({ url: "http://localhost:3100" });
  });

  it("con rol de plataforma redirige a /plataforma", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    expect(await renderHomeExpectingRedirect()).toBe("/plataforma");
  });

  it("con una sola entidad redirige a /entidad/{slug}", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: buildPlatformRole(null),
    });

    expect(await renderHomeExpectingRedirect()).toBe("/entidad/alfaville");
  });

  it("con una entidad paraguas redirige a /paraguas/{slug}", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [
          buildOrgMembership({
            role: "analista",
            organization_slug: "diputacion-demo",
            org_type: "administracion",
          }),
        ],
      }),
      platformRole: buildPlatformRole(null),
    });

    expect(await renderHomeExpectingRedirect()).toBe("/paraguas/diputacion-demo");
  });

  it("con varias entidades redirige a /elegir-entidad", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [
          buildOrgMembership({ role: "titular", organization_slug: "alfaville" }),
          buildOrgMembership({ role: "moderador", organization_slug: "betaville" }),
        ],
      }),
      platformRole: buildPlatformRole(null),
    });

    expect(await renderHomeExpectingRedirect()).toBe("/elegir-entidad");
  });

  function sessionWithoutAccess() {
    return {
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    };
  }

  it("sin ningún acceso no tiene violaciones de accesibilidad (axe)", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/popyplan/id1");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "https://play.google.com/store/apps/details?id=com.popyplan");

    const { container } = render(await Home());

    expect(await axe(container)).toHaveNoViolations();
  });

  it("sin ningún acceso pinta la pantalla de cuenta de la app con «Abrir la app» y «Cerrar sesión»", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());

    render(await Home());

    expect(
      screen.getByRole("heading", { level: 1, name: "Tu cuenta es de la app Popyplan" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir la app" })).toHaveAttribute(
      "href",
      "popyplan://",
    );
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("sin tiendas configuradas no pinta ningún botón de tienda", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", undefined);

    render(await Home());

    expect(screen.queryByRole("link", { name: "Descargar en el App Store" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Descargar en Google Play" })).toBeNull();
  });

  it("con las tiendas configuradas pinta los dos botones con su URL", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/popyplan/id1");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "https://play.google.com/store/apps/details?id=com.popyplan");

    render(await Home());

    expect(screen.getByRole("link", { name: "Descargar en el App Store" })).toHaveAttribute(
      "href",
      "https://apps.apple.com/app/popyplan/id1",
    );
    expect(screen.getByRole("link", { name: "Descargar en Google Play" })).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=com.popyplan",
    );
  });

  it("con un rol de plataforma desconocido redirige a su entidad, no a /plataforma", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: { role: "rol-que-el-backend-inventa" },
    });

    expect(await renderHomeExpectingRedirect()).toBe("/entidad/alfaville");
  });
});
