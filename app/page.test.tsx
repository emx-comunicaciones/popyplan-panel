import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import Home from "./page";

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
  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    expect(await renderHomeExpectingRedirect()).toBe("/login");
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
