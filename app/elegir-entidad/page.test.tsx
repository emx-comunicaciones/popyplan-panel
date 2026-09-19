import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import ElegirEntidadPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
});

describe("ElegirEntidadPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Elige una entidad");
  });

  it("lista las entidades disponibles con enlace a cada panel", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [
          buildOrgMembership({ role: "titular", organization_slug: "alfaville", organization_name: "Alfaville" }),
          buildOrgMembership({ role: "moderador", organization_slug: "betaville", organization_name: "Betaville" }),
        ],
      }),
      platformRole: buildPlatformRole(null),
    });

    const element = await ElegirEntidadPage();
    render(element);

    const alfaville = screen.getByRole("link", { name: "Alfaville" });
    const betaville = screen.getByRole("link", { name: "Betaville" });
    expect(alfaville).toHaveAttribute("href", "/entidad/alfaville");
    expect(betaville).toHaveAttribute("href", "/entidad/betaville");
  });

  it("con una sola entidad redirige directamente a su panel", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: buildPlatformRole(null),
    });

    await expect(ElegirEntidadPage()).rejects.toEqual(
      expect.objectContaining({ url: "/entidad/alfaville" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("con rol de plataforma redirige a /plataforma", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    await expect(ElegirEntidadPage()).rejects.toEqual(
      expect.objectContaining({ url: "/plataforma" } satisfies Partial<NextRedirectSignal>),
    );
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

    await expect(ElegirEntidadPage()).rejects.toEqual(
      expect.objectContaining({ url: "/paraguas/diputacion-demo" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin ningún acceso redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(ElegirEntidadPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(ElegirEntidadPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
