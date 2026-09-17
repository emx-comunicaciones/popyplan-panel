import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
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
});

describe("ParaguasLayout", () => {
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
});
