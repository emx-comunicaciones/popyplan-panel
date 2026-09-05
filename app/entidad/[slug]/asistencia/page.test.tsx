import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useEntityEventsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useEntityEvents", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useEntityEvents")>(
    "@/hooks/useEntityEvents",
  );
  return { ...actual, useEntityEvents: useEntityEventsMock };
});

import EntidadAsistenciaIndexPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useEntityEventsMock.mockReset();
});

async function renderPage(slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role: "titular", organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadAsistenciaIndexPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadAsistenciaIndexPage", () => {
  it("lista las actividades para elegir cuál gestionar, con enlace a asistencia/{id}", async () => {
    useEntityEventsMock.mockReturnValue({
      data: [
        {
          id: "e3",
          title: "E3",
          starts_at: "2026-01-08T18:00:00Z",
          status: "scheduled",
          audience: "community",
          community: { id: "c1", name: "Comunidad Uno" },
          organizer: null,
          capacity: null,
          registered: 1,
          attended: 2,
          no_show: 0,
        },
      ],
      isError: false,
      error: null,
    });

    await renderPage();

    expect(screen.getByRole("heading", { name: "Asistencia" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /E3/ })).toHaveAttribute(
      "href",
      "/entidad/alfaville/asistencia/e3",
    );
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadAsistenciaIndexPage({ params: Promise.resolve({ slug: "alfaville" }) }),
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
      EntidadAsistenciaIndexPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
