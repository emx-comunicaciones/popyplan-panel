import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import Home, { generateMetadata } from "./page";

/** Fichas reales, el valor por defecto de `lib/config/site.ts::storeLinks()`. */
const DEFAULT_APP_STORE = "https://apps.apple.com/us/app/polypop/id6755899118";
const DEFAULT_PLAY_STORE = "https://play.google.com/store/apps/details?id=com.tikneo.popmobile";

const APP_STORE_NAME = "Descargar en el App Store";
const PLAY_STORE_NAME = "Descargar en Google Play";

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

  it("sin sesión pinta la portada con el titular del rediseño", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(
      screen.getByRole("heading", { level: 1, name: "Planes sanos, gente activa." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Deporte, naturaleza y buena compañía. Sin alcohol ni drogas."),
    ).toBeInTheDocument();
  });

  it("el conmutador ofrece Planes y Comunidades, con Planes activo de entrada", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("button", { name: "Planes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Comunidades" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Diseñado para quien cuida su cuerpo y a su gente.",
      }),
    ).toBeInTheDocument();
  });

  it("pinta las tres funcionalidades bajo su encabezado", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(
      screen.getByRole("heading", { level: 2, name: "Funcionalidades" }),
    ).toBeInTheDocument();
    for (const name of [
      "Comunidades por deporte y afición",
      "Planes cerca de ti",
      "Comparte tus logros",
    ]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
  });

  it("pinta los tres valores, con el compromiso de planes sin alcohol ni drogas", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(
      screen.getByRole("heading", { level: 2, name: "Lo que nos diferencia" }),
    ).toBeInTheDocument();
    for (const name of [
      "100 % libre de alcohol y drogas",
      "Gente real, planes reales",
      "Tu privacidad, primero",
    ]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
  });

  it("el banner de descarga cierra la página con su llamada", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Descárgala gratis y empieza a moverte con tu gente.",
      }),
    ).toBeInTheDocument();
  });

  it("sin sesión ofrece entrar al panel desde la cabecera", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it("la cabecera enlaza las tres secciones de la página", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Inicio" })[0]).toHaveAttribute("href", "#inicio");
    expect(screen.getAllByRole("link", { name: "Funcionalidades" })[0]).toHaveAttribute(
      "href",
      "#funcionalidades",
    );
    expect(screen.getByRole("link", { name: "Descarga la app" })).toHaveAttribute(
      "href",
      "#descarga",
    );
  });

  it("sin variables de tienda enlaza las fichas reales, no oculta los botones", async () => {
    // Cambio del rediseño: la descarga es la llamada principal de la
    // web, así que no puede depender de dos variables de entorno.
    getServerSessionMock.mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", undefined);

    render(await Home());

    // `<StoreLinks />` se monta dos veces (la portada y el banner de
    // descarga), así que hay dos enlaces con el mismo nombre accesible.
    const appStoreLinks = screen.getAllByRole("link", { name: APP_STORE_NAME });
    expect(appStoreLinks).toHaveLength(2);
    for (const link of appStoreLinks) {
      expect(link).toHaveAttribute("href", DEFAULT_APP_STORE);
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
    }

    const playStoreLinks = screen.getAllByRole("link", { name: PLAY_STORE_NAME });
    expect(playStoreLinks).toHaveLength(2);
    for (const link of playStoreLinks) {
      expect(link).toHaveAttribute("href", DEFAULT_PLAY_STORE);
    }
  });

  it("con las variables declaradas manda su valor", async () => {
    getServerSessionMock.mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/popyplan/id1");
    vi.stubEnv(
      "NEXT_PUBLIC_PLAY_STORE_URL",
      "https://play.google.com/store/apps/details?id=com.popyplan",
    );

    render(await Home());

    for (const link of screen.getAllByRole("link", { name: APP_STORE_NAME })) {
      expect(link).toHaveAttribute("href", "https://apps.apple.com/app/popyplan/id1");
    }
    for (const link of screen.getAllByRole("link", { name: PLAY_STORE_NAME })) {
      expect(link).toHaveAttribute(
        "href",
        "https://play.google.com/store/apps/details?id=com.popyplan",
      );
    }
  });

  it("con una variable de tienda inservible no pinta esa insignia", async () => {
    getServerSessionMock.mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "javascript:alert(1)");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "no soy una url");

    render(await Home());

    expect(screen.queryByRole("link", { name: APP_STORE_NAME })).toBeNull();
    expect(screen.queryByRole("link", { name: PLAY_STORE_NAME })).toBeNull();
  });

  it("el pie lleva el QR, los cuatro enlaces legales, accesibilidad y el acceso al panel", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(
      screen.getByRole("img", { name: "Código QR para descargar Popyplan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Escanea el código QR para descargar la aplicación"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Soporte" })).toHaveAttribute(
      "href",
      "https://popyplan.com/support",
    );
    expect(screen.getByRole("link", { name: "Privacidad" })).toHaveAttribute(
      "href",
      "https://popyplan.com/privacy",
    );
    expect(screen.getByRole("link", { name: "Términos" })).toHaveAttribute(
      "href",
      "https://popyplan.com/terms",
    );
    expect(screen.getByRole("link", { name: "Eliminar cuenta" })).toHaveAttribute(
      "href",
      "https://popyplan.com/delete-account",
    );
    expect(screen.getByRole("link", { name: "Accesibilidad" })).toHaveAttribute(
      "href",
      "/accesibilidad",
    );
    expect(screen.getByRole("link", { name: "Acceso al panel" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("el aviso de derechos lleva el año en curso sin separador de millares", async () => {
    // `{year}` se pasa como cadena a propósito: un número lo formatearía
    // `Intl` en es-ES como «2.026».
    getServerSessionMock.mockResolvedValue(null);
    const year = new Date().getFullYear();

    render(await Home());

    expect(
      screen.getByText(`© ${year} Popyplan. Todos los derechos reservados.`),
    ).toBeInTheDocument();
  });

  it("generateMetadata describe la landing con su Open Graph", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com");

    const metadata = await generateMetadata();

    expect(metadata.title).toEqual({
      absolute: "Popyplan · Planes sanos, gente activa",
    });
    expect(metadata.description).toBe(
      "Deporte, naturaleza y buena compañía. Planes y comunidades sin alcohol ni drogas, cerca de ti.",
    );
    expect(metadata.openGraph).toMatchObject({
      title: "Popyplan · Planes sanos, gente activa",
      url: "https://popyplan.com",
      siteName: "Popyplan",
      locale: "es_ES",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    // La imagen de compartir la genera `app/opengraph-image.tsx` y la
    // inyecta Next; declarar aquí un `images` a mano la duplicaría.
    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.twitter).not.toHaveProperty("images");
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

    const { container } = render(await Home());

    expect(await axe(container)).toHaveNoViolations();
  });

  it("sin ningún acceso pinta la pantalla de cuenta de la app con «Abrir la app» y «Cerrar sesión»", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());

    render(await Home());

    expect(
      screen.getByRole("heading", { level: 1, name: "Tu cuenta es de la app Popyplan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tu sitio está en la app: ahí tienes tus planes, tus comunidades y tu gente. Descárgala y entra con esta misma cuenta.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir la app" })).toHaveAttribute(
      "href",
      "popyplan://",
    );
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("sin ningún acceso ofrece cambiar de idioma desde su cabecera", async () => {
    // Era la única pantalla del producto sin selector de idioma (M10), y
    // justo la que ve quien quizá no lee el idioma que le ha tocado.
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());

    render(await Home());

    expect(screen.getByLabelText("Idioma")).toBeInTheDocument();
  });

  it("sin ningún acceso ofrece descargar la app con las fichas por defecto", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", undefined);

    render(await Home());

    expect(screen.getByRole("link", { name: APP_STORE_NAME })).toHaveAttribute(
      "href",
      DEFAULT_APP_STORE,
    );
    expect(screen.getByRole("link", { name: PLAY_STORE_NAME })).toHaveAttribute(
      "href",
      DEFAULT_PLAY_STORE,
    );
  });

  it("sin ninguna ficha válida no pinta ningún botón de tienda", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "no soy una url");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "no soy una url");

    render(await Home());

    expect(screen.queryByRole("link", { name: APP_STORE_NAME })).toBeNull();
    expect(screen.queryByRole("link", { name: PLAY_STORE_NAME })).toBeNull();
    // La etiqueta tampoco se pinta: un rótulo suelto sin botones debajo
    // se lee como algo que falta.
    expect(screen.queryByText("Descarga la app")).toBeNull();
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
