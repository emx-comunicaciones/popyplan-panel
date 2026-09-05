import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import {
  buildByOrganizationRows,
  buildByPlaceRows,
  buildCompareResponse,
  buildMetricsResponse,
  buildSeriesRows,
} from "@/test-utils/fixtures/metrics";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import type { MetricsGroupBy, MetricsScope } from "@/hooks/useMetrics";
import { MetricsError } from "@/hooks/useMetrics";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const serverFetchMock = vi.hoisted(() => vi.fn());
const useMetricsMock = vi.hoisted(() => vi.fn());
const useCompareMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));
vi.mock("@/hooks/useMetrics", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useMetrics")>("@/hooks/useMetrics");
  return { ...actual, useMetrics: useMetricsMock };
});
vi.mock("@/hooks/useCompare", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCompare")>("@/hooks/useCompare");
  return { ...actual, useCompare: useCompareMock };
});

import ParaguasInicioPage from "./page";

function mockMetricsByGroup(
  handlers: Partial<Record<"base" | MetricsGroupBy, ReturnType<typeof buildMetricsResponse>>>,
) {
  useMetricsMock.mockImplementation(
    (_scope: MetricsScope, _orgId: unknown, _period: unknown, groupBy?: MetricsGroupBy) => {
      const data = groupBy ? handlers[groupBy] : handlers.base;
      return { data, isError: false, error: null };
    },
  );
}

function mockCompare(data: ReturnType<typeof buildCompareResponse> | undefined = buildCompareResponse()) {
  useCompareMock.mockReturnValue({ data, isError: false, error: null });
}

afterEach(() => {
  getServerSessionMock.mockReset();
  serverFetchMock.mockReset();
  useMetricsMock.mockReset();
  useCompareMock.mockReset();
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
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: buildByPlaceRows() }),
      organization: buildMetricsResponse({ by_place: buildByOrganizationRows() }),
      month: buildMetricsResponse({ series: buildSeriesRows() }),
    });

    mockCompare();
    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("muestra las tarjetas con las cifras del ejemplo de docs/PANEL.md §1.4", async () => {
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: buildByPlaceRows() }),
      organization: buildMetricsResponse({ by_place: buildByOrganizationRows() }),
      month: buildMetricsResponse({ series: buildSeriesRows() }),
    });

    mockCompare();
    await renderPage();

    expect(screen.getByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByText("Personas activas")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("Asistencia")).toBeInTheDocument();
    expect(screen.getByText("72,7 %")).toBeInTheDocument();
    expect(screen.getByText("No-shows")).toBeInTheDocument();
    expect(screen.getByText("Actividades celebradas")).toBeInTheDocument();
  });

  it("tabla «Por municipio»: nombre + código INE, y `<5` cuando está suprimido", async () => {
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: buildByPlaceRows() }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
    });

    mockCompare();
    await renderPage();

    expect(screen.getByText("Por municipio")).toBeInTheDocument();
    expect(screen.getByText("Alfaville")).toBeInTheDocument();
    expect(screen.getByText("30001")).toBeInTheDocument();
    expect(screen.getByText("Betaville")).toBeInTheDocument();
    expect(screen.getAllByText("<5").length).toBeGreaterThan(0);
  });

  it("tabla «Por entidad»: filas de las entidades hijas", async () => {
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: [] }),
      organization: buildMetricsResponse({ by_place: buildByOrganizationRows() }),
      month: buildMetricsResponse({ series: [] }),
    });

    mockCompare();
    await renderPage();

    expect(screen.getByText("Por entidad")).toBeInTheDocument();
    expect(screen.getByText("Asociación Hija Uno")).toBeInTheDocument();
    expect(screen.getByText("Asociación Hija Dos")).toBeInTheDocument();
  });

  it("estado vacío: sin filas en un desglose, pinta el aviso en vez de una tabla vacía", async () => {
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: [] }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
    });

    mockCompare();
    await renderPage();

    expect(screen.getByText("Sin municipios con datos en este periodo")).toBeInTheDocument();
    expect(screen.getByText("Sin entidades con datos en este periodo")).toBeInTheDocument();
    expect(screen.getByText("Sin datos suficientes para la serie mensual")).toBeInTheDocument();
  });

  it("estado de error: useMetrics de la base en error pinta ErrorState", async () => {
    useMetricsMock.mockImplementation((_scope: MetricsScope, _orgId: unknown, _period: unknown, groupBy?: MetricsGroupBy) => {
      if (!groupBy) {
        return {
          data: undefined,
          isError: true,
          error: new MetricsError("sin_acceso", "No tienes acceso a estas métricas."),
        };
      }
      return { data: buildMetricsResponse(), isError: false, error: null };
    });
    mockCompare();
    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las métricas");
    expect(screen.getByText("No tienes acceso a estas métricas.")).toBeInTheDocument();
  });

  it("Comparativa: pinta la tabla con el desglose por defecto 'comarca'", async () => {
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: [] }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
    });
    mockCompare();

    await renderPage();

    expect(useCompareMock).toHaveBeenCalledWith(
      "paraguas",
      expect.anything(),
      expect.anything(),
      "comarca",
    );
    expect(screen.getByText("Comparativa")).toBeInTheDocument();
    expect(screen.getByText("Bidasoa")).toBeInTheDocument();
  });

  it("Comparativa: cambiar el `<select>` a «Entidad» pide el desglose 'organization'", async () => {
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: [] }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
    });
    mockCompare();
    const user = userEvent.setup();

    await renderPage();
    await user.selectOptions(screen.getByLabelText("Desglose de la comparativa"), "Entidad");

    expect(useCompareMock).toHaveBeenLastCalledWith(
      "paraguas",
      expect.anything(),
      expect.anything(),
      "organization",
    );
  });

  it("Comparativa: sin filas, pinta el aviso; en error, pinta ErrorState", async () => {
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: [] }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
    });
    mockCompare(buildCompareResponse({ rows: [] }));

    await renderPage();

    expect(screen.getByText("Sin datos para esta comparativa")).toBeInTheDocument();
  });

  it("plurianual: elegir el preset cambia la serie a anual y a group_by='year'", async () => {
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: [] }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
      year: buildMetricsResponse({ series: [{ year: "2025", events: 5, people: 13, suppressed: false }] }),
    });
    mockCompare();
    const user = userEvent.setup();

    await renderPage();
    expect(screen.getByText("Serie mensual")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Plurianual" }));

    expect(screen.getByText("Serie anual")).toBeInTheDocument();
    expect(useMetricsMock).toHaveBeenLastCalledWith(
      "paraguas",
      expect.anything(),
      expect.anything(),
      "year",
    );
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
