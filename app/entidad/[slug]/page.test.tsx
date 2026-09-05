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

import EntidadInicioPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  serverFetchMock.mockReset();
});

describe("EntidadInicioPage", () => {
  it("muestra el nombre de la entidad traído de GET /api/organizations/{id}/", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: buildPlatformRole(null),
    });
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ name: "Asociación Vecinal Alfaville" }),
    });

    const element = await EntidadInicioPage({ params: Promise.resolve({ slug: "alfaville" }) });
    render(element);

    expect(screen.getByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByText("Asociación Vecinal Alfaville")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadInicioPage({ params: Promise.resolve({ slug: "alfaville" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>));
  });

  it("sin membresía en esa entidad redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: buildPlatformRole(null),
    });

    await expect(
      EntidadInicioPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });

  it("si falla la ficha de la entidad, usa el nombre de la membresía", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [
          buildOrgMembership({
            role: "titular",
            organization_slug: "alfaville",
            organization_name: "Alfaville (membresía)",
          }),
        ],
      }),
      platformRole: buildPlatformRole(null),
    });
    serverFetchMock.mockResolvedValue({ ok: false, status: 500, body: null });

    const element = await EntidadInicioPage({ params: Promise.resolve({ slug: "alfaville" }) });
    render(element);

    expect(screen.getByText("Alfaville (membresía)")).toBeInTheDocument();
  });
});
