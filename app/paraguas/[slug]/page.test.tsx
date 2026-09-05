import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const serverFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));

import ParaguasInicioPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  serverFetchMock.mockReset();
});

describe("ParaguasInicioPage", () => {
  it("muestra el nombre de la entidad paraguas", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [
          buildOrgMembership({ role: "analista", organization_slug: "diputacion-demo" }),
        ],
      }),
      platformRole: buildPlatformRole(null),
    });
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ name: "Diputación Demo" }),
    });

    const element = await ParaguasInicioPage({ params: Promise.resolve({ slug: "diputacion-demo" }) });
    render(element);

    expect(screen.getByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByText("Diputación Demo")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      ParaguasInicioPage({ params: Promise.resolve({ slug: "diputacion-demo" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" }));
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
      ParaguasInicioPage({ params: Promise.resolve({ slug: "otra-diputacion" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" }));
  });
});
