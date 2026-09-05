import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { render, screen, waitFor } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaInicioPage from "./page";

const ORGS_PAGE = (count: number) => ({
  count,
  next: null,
  previous: null,
  results: [] as unknown[],
});

function mockApiFetch() {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path === "/api/admin/dashboard-stats/") {
      return {
        totals: { users: 100, events: 10, chats: 0, communities: 5 },
        users: { active: 42, blocked: 0, verified: 30, new_today: 1, new_week: 3, growth_pct: 5 },
        events: { scheduled: 7, growth_pct: 1, by_audience: [] },
        reports: { pending: 2 },
        help_requests: { pending: 1 },
        registrations_weekly: [],
      };
    }
    if (path.startsWith("/api/safety/reports/queue/")) {
      // Array plano de verdad (no `{count, ...}`, docs/SEGURIDAD_Y_MODERACION.md §4).
      return [{}, {}, {}];
    }
    if (path.startsWith("/api/organizations/?page=")) {
      return ORGS_PAGE(0);
    }
    if (path.startsWith("/api/organizations/?verified=true")) {
      return ORGS_PAGE(5);
    }
    if (path.startsWith("/api/organizations/?verified=false")) {
      return ORGS_PAGE(2);
    }
    throw new Error(`sin mock para ${path}`);
  });
}

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

describe("PlataformaInicioPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockApiFetch();
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaInicioPage();
    const { container } = render(element);

    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });

  it("superadmin ve todas las tarjetas con sus cifras", async () => {
    mockApiFetch();
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaInicioPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("verifier no ve tarjetas de reportes/ayuda (sin acceso ni menú)", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/admin/dashboard-stats/") {
        throw Object.assign(new Error("403"), { status: 403 });
      }
      if (path.startsWith("/api/organizations/?page=")) return ORGS_PAGE(0);
      if (path.startsWith("/api/organizations/?verified=true")) return ORGS_PAGE(5);
      if (path.startsWith("/api/organizations/?verified=false")) return ORGS_PAGE(2);
      throw new Error(`sin mock para ${path}`);
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const element = await PlataformaInicioPage();
    render(element);

    await waitFor(() => expect(screen.getByText("5")).toBeInTheDocument());
    expect(screen.queryByText("Reportes pendientes")).not.toBeInTheDocument();
    expect(screen.queryByText("Solicitudes de ayuda pendientes")).not.toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaInicioPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaInicioPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
