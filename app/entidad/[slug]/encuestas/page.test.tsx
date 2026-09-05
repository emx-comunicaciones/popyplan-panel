import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import EntidadEncuestasPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
});

async function renderPage(role: string, slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadEncuestasPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadEncuestasPage", () => {
  it("titular ve el aviso «Próximamente»", async () => {
    await renderPage("titular");

    expect(screen.getByRole("heading", { name: "Encuestas" })).toBeInTheDocument();
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
  });

  it("moderador ve el aviso «Próximamente»", async () => {
    await renderPage("moderador");

    expect(screen.getByText("Próximamente")).toBeInTheDocument();
  });

  it("dinamizador ve «Sin acceso» (la sección está oculta de su menú)", async () => {
    await renderPage("dinamizador");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(screen.queryByText("Próximamente")).not.toBeInTheDocument();
  });

  it("analista ve «Sin acceso»", async () => {
    await renderPage("analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadEncuestasPage({ params: Promise.resolve({ slug: "alfaville" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>));
  });

  it("sin membresía en esa entidad redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: { role: null },
    });

    await expect(
      EntidadEncuestasPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
