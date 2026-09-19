import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal, setPathname } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const serverFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));

import ParaguasLayout from "./layout";

afterEach(() => {
  getServerSessionMock.mockReset();
  serverFetchMock.mockReset();
  vi.unstubAllEnvs();
});

function session(role: string) {
  return {
    token: "t",
    me: buildMe({
      org_memberships: [
        buildOrgMembership({
          role,
          organization_slug: "diputacion-demo",
          organization_name: "Diputación Demo",
        }),
      ],
    }),
    platformRole: buildPlatformRole(null),
  };
}

describe("ParaguasLayout", () => {
  it("la cabecera lleva el botón de ayuda de la pantalla actual", async () => {
    setPathname("/paraguas/diputacion-demo");
    getServerSessionMock.mockResolvedValue(session("analista"));
    serverFetchMock.mockResolvedValue({ ok: true, status: 200, data: buildOrganization() });

    const element = await ParaguasLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "diputacion-demo" }),
    });
    render(element);

    expect(screen.getByRole("button", { name: /^Ayuda:/ })).toBeInTheDocument();
  });

  it("pinta la cabecera con el nombre de la entidad paraguas", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [
          buildOrgMembership({
            role: "analista",
            organization_slug: "diputacion-demo",
            organization_name: "Diputación Demo",
          }),
        ],
      }),
      platformRole: buildPlatformRole(null),
    });
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ name: "Diputación Demo", org_type: "administracion" }),
    });

    const element = await ParaguasLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "diputacion-demo" }),
    });
    render(element);

    expect(screen.getByText("Diputación Demo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "href",
      "/paraguas/diputacion-demo",
    );
    expect(screen.getByRole("link", { name: "Informes" })).toHaveAttribute(
      "href",
      "/paraguas/diputacion-demo/informes",
    );
  });

  it("con un color de marca en forma corta (#0a4) lo usa; con uno no calculable cae al tinte", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [
          buildOrgMembership({
            role: "analista",
            organization_slug: "diputacion-demo",
            organization_name: "Diputación Demo",
          }),
        ],
      }),
      platformRole: buildPlatformRole(null),
    });
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ primary_color: "#0a4" }),
    });

    const corto = await ParaguasLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "diputacion-demo" }),
    });
    const { container, unmount } = render(corto);
    expect(container.querySelector("header")?.style.backgroundColor).toBe("rgb(0, 170, 68)");
    unmount();

    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ primary_color: "rojo corporativo" }),
    });
    const ilegible = await ParaguasLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "diputacion-demo" }),
    });
    const segundo = render(ilegible);
    const cabecera = segundo.container.querySelector("header");
    expect(cabecera?.style.backgroundColor).toBe("var(--color-primary-100)");
    // La franja inferior no repite el color inválido.
    expect(cabecera?.style.borderBottom).toBe("6px solid var(--color-primary)");
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      ParaguasLayout({ children: <p />, params: Promise.resolve({ slug: "diputacion-demo" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>));
  });

  it("con rol de plataforma redirige a /plataforma", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    await expect(
      ParaguasLayout({ children: <p />, params: Promise.resolve({ slug: "diputacion-demo" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/plataforma" } satisfies Partial<NextRedirectSignal>));
  });

  it("sin membresía en esa entidad paraguas redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "analista", organization_slug: "diputacion-demo" })],
      }),
      platformRole: buildPlatformRole(null),
    });

    await expect(
      ParaguasLayout({ children: <p />, params: Promise.resolve({ slug: "otra-diputacion" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });

  it("referente no ve «Informes» en el menú (no exporta informes)", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [
          buildOrgMembership({ role: "referente", organization_slug: "diputacion-demo" }),
        ],
      }),
      platformRole: buildPlatformRole(null),
    });
    serverFetchMock.mockResolvedValue({ ok: true, status: 200, data: buildOrganization() });

    const element = await ParaguasLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "diputacion-demo" }),
    });
    render(element);

    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Informes" })).not.toBeInTheDocument();
  });

  it("con un rol de plataforma desconocido NO va a /plataforma: pinta el panel del paraguas", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [
          buildOrgMembership({
            role: "analista",
            organization_slug: "diputacion-demo",
            organization_name: "Diputación Demo",
          }),
        ],
      }),
      platformRole: { role: "rol-que-el-backend-inventa" },
    });
    serverFetchMock.mockResolvedValue({ ok: true, status: 200, data: buildOrganization() });

    const element = await ParaguasLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "diputacion-demo" }),
    });
    render(element);

    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("con logo en un host permitido pinta la imagen del paraguas", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ logo: "https://api.test/media/logo.png" }),
    });

    const element = await ParaguasLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "diputacion-demo" }),
    });
    const { container } = render(element);

    expect(container.querySelector("img")).not.toBeNull();
  });

  it("con un logo en un host NO permitido no pinta imagen y el layout sigue en pie", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ logo: "https://host-ajeno.example/logo.png" }),
    });

    const element = await ParaguasLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "diputacion-demo" }),
    });
    const { container } = render(element);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });
});
