import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import Home from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
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

  it("sin ningún acceso renderiza el estado de 'sin acceso' con salir de sesión", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    const element = await Home();
    render(element);

    expect(screen.getByText("No tienes acceso a ningún área del panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });
});
