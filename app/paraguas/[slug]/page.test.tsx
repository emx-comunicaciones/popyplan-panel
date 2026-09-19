import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildMetricsResponse } from "@/test-utils/fixtures/metrics";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import type { MetricsScope } from "@/hooks/useMetrics";
import { MetricsError } from "@/hooks/useMetrics";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const serverFetchMock = vi.hoisted(() => vi.fn());
const useMetricsMock = vi.hoisted(() => vi.fn());
const useOrganizationsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));
vi.mock("@/hooks/useMetrics", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useMetrics")>("@/hooks/useMetrics");
  return { ...actual, useMetrics: useMetricsMock };
});
vi.mock("@/hooks/useOrganizations", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useOrganizations")>(
    "@/hooks/useOrganizations",
  );
  return { ...actual, useOrganizations: useOrganizationsMock };
});

import ParaguasInicioPage, { generateMetadata } from "./page";

function mockMetricsByScope(
  handlers: Partial<Record<MetricsScope, ReturnType<typeof buildMetricsResponse>>>,
) {
  useMetricsMock.mockImplementation((scope: MetricsScope) => ({
    data: handlers[scope],
    isError: false,
    error: null,
  }));
}

function mockChildren(count = 3) {
  useOrganizationsMock.mockReturnValue({
    data: { count, next: null, previous: null, results: [] },
    isError: false,
    error: null,
  });
}

afterEach(() => {
  getServerSessionMock.mockReset();
  serverFetchMock.mockReset();
  useMetricsMock.mockReset();
  useOrganizationsMock.mockReset();
});

async function renderPage(slug = "diputacion-demo") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role: "analista", organization_slug: slug })],
    }),
    platformRole: buildPlatformRole(null),
  });
  serverFetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    data: buildOrganization({ name: "Diputación Demo" }),
  });

  const element = await ParaguasInicioPage({ params: Promise.resolve({ slug }) });
  return render(element);
}

describe("ParaguasInicioPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Inicio del paraguas");
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockMetricsByScope({ territorio: buildMetricsResponse(), paraguas: buildMetricsResponse() });
    mockChildren();

    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("resume el territorio y la red financiada, cada uno con su enlace", async () => {
    mockMetricsByScope({ territorio: buildMetricsResponse(), paraguas: buildMetricsResponse() });
    mockChildren();

    await renderPage();

    const territorio = screen.getByRole("region", { name: "Tu territorio" });
    expect(within(territorio).getByText("Personas activas")).toBeInTheDocument();
    expect(within(territorio).getByRole("link", { name: "Ver el territorio" })).toHaveAttribute(
      "href",
      "/paraguas/diputacion-demo/territorio",
    );

    const red = screen.getByRole("region", { name: "Red financiada" });
    expect(within(red).getByText("Entidades financiadas")).toBeInTheDocument();
    expect(within(red).getByRole("link", { name: "Ver la red financiada" })).toHaveAttribute(
      "href",
      "/paraguas/diputacion-demo/red-financiada",
    );
  });

  it("sin territorio declarado, el bloque de territorio lo dice y el de red financiada sigue entero", async () => {
    useMetricsMock.mockImplementation((scope: MetricsScope) =>
      scope === "territorio"
        ? {
            data: undefined,
            isError: true,
            error: new MetricsError(
              "sin_territorio",
              "Esta administración no tiene territorio declarado.",
              "Esta administración no tiene territorio declarado.",
            ),
          }
        : { data: buildMetricsResponse(), isError: false, error: null },
    );
    mockChildren();

    await renderPage();

    expect(
      screen.getByText("Esta administración no tiene territorio declarado."),
    ).toBeInTheDocument();
    expect(screen.getByText("Entidades financiadas")).toBeInTheDocument();
  });

  it("un error real (no sin_territorio) del territorio pinta ErrorState", async () => {
    useMetricsMock.mockImplementation((scope: MetricsScope) =>
      scope === "territorio"
        ? {
            data: undefined,
            isError: true,
            error: new MetricsError("sin_acceso", "No tienes acceso a estas métricas."),
          }
        : { data: buildMetricsResponse(), isError: false, error: null },
    );
    mockChildren();

    await renderPage();

    expect(screen.getByText("No tienes acceso a estas métricas.")).toBeInTheDocument();
  });

  it("un error de la red financiada pinta ErrorState en su propio bloque", async () => {
    useMetricsMock.mockImplementation((scope: MetricsScope) =>
      scope === "paraguas"
        ? {
            data: undefined,
            isError: true,
            error: new MetricsError("desconocido", "Error de red.", "Error de red."),
          }
        : { data: buildMetricsResponse(), isError: false, error: null },
    );
    mockChildren();

    await renderPage();

    expect(screen.getByText("Error de red.")).toBeInTheDocument();
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
