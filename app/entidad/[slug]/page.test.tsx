import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildMetricsResponse } from "@/test-utils/fixtures/metrics";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { buildProgram } from "@/test-utils/fixtures/program";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const serverFetchMock = vi.hoisted(() => vi.fn());
const useEntityHomeMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));
vi.mock("@/hooks/useEntityHome", () => ({ useEntityHome: useEntityHomeMock }));

import EntidadInicioPage, { generateMetadata } from "./page";

const TODAY_EVENT = {
  id: "e1",
  title: "Taller de costura",
  starts_at: "2026-01-15T18:00:00.000Z",
  status: "scheduled",
  audience: "anyone",
  community: null,
  organizer: { user_id: 1, public_name: "Titular" },
  capacity: 20,
  registered: 5,
  attended: 0,
  no_show: 0,
};

function homeState(overrides: Record<string, unknown> = {}) {
  return {
    today: { data: [TODAY_EVENT], isError: false, error: null },
    pendingReports: { data: 3, isError: false },
    pendingHelpRequests: { data: 1, isError: false },
    metrics: { data: buildMetricsResponse(), isError: false, error: null },
    activePrograms: {
      data: [buildProgram({ status: "active" }), buildProgram({ status: "draft" })],
      isError: false,
      error: null,
    },
    ...overrides,
  };
}

afterEach(() => {
  getServerSessionMock.mockReset();
  serverFetchMock.mockReset();
  useEntityHomeMock.mockReset();
});

async function renderPage(slug = "alfaville", role = "titular") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: buildPlatformRole(null),
  });
  serverFetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    data: buildOrganization({ name: "Asociación Vecinal Alfaville" }),
  });

  const element = await EntidadInicioPage({ params: Promise.resolve({ slug }) });
  return render(element);
}

describe("EntidadInicioPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Inicio de la entidad");
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    useEntityHomeMock.mockReturnValue(homeState());

    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("muestra actividades de hoy y avisos pendientes", async () => {
    useEntityHomeMock.mockReturnValue(homeState());

    await renderPage();

    expect(screen.getByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByText("Taller de costura")).toBeInTheDocument();
    expect(screen.getByText(/5 inscritos \/ 20 plazas/)).toBeInTheDocument();
    expect(screen.getByText(/Titular/)).toBeInTheDocument();
    expect(screen.getByText("Solicitudes de ayuda pendientes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a Guardia" })).toHaveAttribute(
      "href",
      "/entidad/alfaville/guardia",
    );
    const reportesCard = screen.getByText("Reportes pendientes").parentElement;
    expect(reportesCard).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "Ir a Reportes" })).toHaveAttribute(
      "href",
      "/entidad/alfaville/reportes",
    );
  });

  it("pinta las tarjetas de métricas del mes con la regla <5", async () => {
    useEntityHomeMock.mockReturnValue(
      homeState({
        metrics: {
          data: buildMetricsResponse({
            people: { active: null, new: null, repeating: null, suppressed: true },
          }),
          isError: false,
          error: null,
        },
      }),
    );

    await renderPage();

    expect(screen.getByText("Personas activas")).toBeInTheDocument();
    expect(screen.getByText("Altas")).toBeInTheDocument();
    expect(screen.getAllByText("<5").length).toBeGreaterThan(0);
    expect(screen.getByText("Actividades celebradas")).toBeInTheDocument();
  });

  it("pinta «Programas en curso» contando solo los activos, con enlace a Programas", async () => {
    useEntityHomeMock.mockReturnValue(homeState());

    await renderPage();

    const card = screen.getByText("Programas en curso").parentElement;
    expect(card).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: "Ir a Programas" })).toHaveAttribute(
      "href",
      "/entidad/alfaville/programas",
    );
  });

  it("error cargando programas: pinta el aviso en vez de la tarjeta", async () => {
    useEntityHomeMock.mockReturnValue(
      homeState({ activePrograms: { data: undefined, isError: true, error: new Error("fallo") } }),
    );

    await renderPage();

    expect(screen.queryByText("Programas en curso")).not.toBeInTheDocument();
    expect(screen.getByText("No se pudieron cargar los programas.")).toBeInTheDocument();
  });

  it("sin actividades hoy muestra el estado vacío", async () => {
    useEntityHomeMock.mockReturnValue(homeState({ today: { data: [], isError: false, error: null } }));

    await renderPage();

    expect(screen.getByText("Sin actividades hoy")).toBeInTheDocument();
  });

  it("analista (sin ver_lista_nominal en avisos) no ve las tarjetas de ayuda/reportes (count null)", async () => {
    useEntityHomeMock.mockReturnValue(
      homeState({
        pendingReports: { data: null, isError: false },
        pendingHelpRequests: { data: null, isError: false },
      }),
    );

    await renderPage("alfaville", "analista");

    expect(screen.queryByText("Solicitudes de ayuda pendientes")).not.toBeInTheDocument();
    expect(screen.queryByText("Reportes pendientes")).not.toBeInTheDocument();
  });

  it("error real cargando las actividades pinta un ErrorState", async () => {
    useEntityHomeMock.mockReturnValue(
      homeState({
        today: { data: undefined, isError: true, error: new Error("No se pudieron cargar las actividades.") },
      }),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las actividades de hoy");
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

  it("no pide la ficha de la entidad: su nombre ya está en la cabecera del layout", async () => {
    useEntityHomeMock.mockReturnValue(homeState());
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

    // Antes de la pasada de densidad esta página pedía la ficha solo
    // para pintar «Panel de <entidad>.»; sin ese subtítulo, un fallo de
    // esa petición ya no puede afectarle porque ni siquiera la hace.
    expect(serverFetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Inicio" })).toBeInTheDocument();
  });
});
