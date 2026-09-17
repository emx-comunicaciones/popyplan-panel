import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { render, screen } from "@/test-utils/render";
import {
  buildByOrganizationRows,
  buildByPlaceRows,
  buildCompareResponse,
  buildMetricsResponse,
  buildSeriesRows,
} from "@/test-utils/fixtures/metrics";
import type { MetricsGroupBy, MetricsScope } from "@/hooks/useMetrics";
import { MetricsError } from "@/hooks/useMetrics";

const useMetricsMock = vi.hoisted(() => vi.fn());
const useExportMock = vi.hoisted(() => vi.fn());
const useCompareMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useMetrics", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useMetrics")>("@/hooks/useMetrics");
  return { ...actual, useMetrics: useMetricsMock };
});
vi.mock("@/hooks/useExport", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useExport")>("@/hooks/useExport");
  return { ...actual, useExport: useExportMock };
});
vi.mock("@/hooks/useCompare", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCompare")>("@/hooks/useCompare");
  return { ...actual, useCompare: useCompareMock };
});

import PlataformaMetricasPage from "./page";

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
  useMetricsMock.mockReset();
  useExportMock.mockReset();
  useCompareMock.mockReset();
});

describe("PlataformaMetricasPage", () => {
  it("muestra las tarjetas con las cifras del ejemplo de docs/PANEL.md §1.4", () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: buildByPlaceRows() }),
      organization: buildMetricsResponse({ by_place: buildByOrganizationRows() }),
      month: buildMetricsResponse({ series: buildSeriesRows() }),
    });
    mockCompare();

    render(<PlataformaMetricasPage />);

    expect(screen.getByRole("heading", { name: "Métricas" })).toBeInTheDocument();
    expect(screen.getByText("Personas activas")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("Asistencia")).toBeInTheDocument();
    expect(screen.getByText("72,7 %")).toBeInTheDocument();
  });

  it("selector territorio/entidad: por defecto pinta «Por municipio»; al pulsar «Entidad» cambia a «Por entidad»", async () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: buildByPlaceRows() }),
      organization: buildMetricsResponse({ by_place: buildByOrganizationRows() }),
      month: buildMetricsResponse({ series: buildSeriesRows() }),
    });
    mockCompare();
    const user = userEvent.setup();

    render(<PlataformaMetricasPage />);

    expect(screen.getByText("Por municipio")).toBeInTheDocument();
    expect(screen.getByText("Alfaville")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Entidad" }));

    expect(screen.getByText("Por entidad")).toBeInTheDocument();
    expect(screen.getByText("Asociación Hija Uno")).toBeInTheDocument();
  });

  it("«Exportar CSV» llama a useExport().mutate con scope 'plataforma' y format 'csv'", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: buildByPlaceRows() }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
    });
    mockCompare();
    const user = userEvent.setup();

    render(<PlataformaMetricasPage />);
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ scope: "plataforma", format: "csv" }));
  });

  it("estado vacío: sin filas en el desglose, pinta el aviso en vez de una tabla vacía", () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: [] }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
    });
    mockCompare(buildCompareResponse({ rows: [] }));

    render(<PlataformaMetricasPage />);

    expect(screen.getByText("Sin datos para este periodo")).toBeInTheDocument();
    expect(screen.getByText("Sin datos suficientes para la serie mensual")).toBeInTheDocument();
    expect(screen.getByText("Sin datos para esta comparativa")).toBeInTheDocument();
  });

  it("estado de error: useMetrics de la base en error pinta ErrorState", () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    useMetricsMock.mockImplementation(
      (_scope: MetricsScope, _orgId: unknown, _period: unknown, groupBy?: MetricsGroupBy) => {
        if (!groupBy) {
          return {
            data: undefined,
            isError: true,
            error: new MetricsError("sin_acceso", "No tienes acceso a estas métricas."),
          };
        }
        return { data: buildMetricsResponse(), isError: false, error: null };
      },
    );
    mockCompare();

    render(<PlataformaMetricasPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las métricas");
    expect(screen.getByText("No tienes acceso a estas métricas.")).toBeInTheDocument();
  });

  it("estado de error: el desglose agrupado en error pinta ErrorState, no el aviso de «sin datos»", () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    useMetricsMock.mockImplementation(
      (_scope: MetricsScope, _orgId: unknown, _period: unknown, groupBy?: MetricsGroupBy) => {
        if (groupBy === "place") {
          return {
            data: undefined,
            isError: true,
            error: new MetricsError("desconocido", "Error de red."),
          };
        }
        return { data: buildMetricsResponse(), isError: false, error: null };
      },
    );
    mockCompare();

    render(<PlataformaMetricasPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el desglose");
    expect(screen.getByText("Error de red.")).toBeInTheDocument();
    expect(screen.queryByText("Sin datos para este periodo")).not.toBeInTheDocument();
  });

  it("Comparativa: pinta la tabla con el desglose por defecto 'province'", () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: [] }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
    });
    mockCompare();

    render(<PlataformaMetricasPage />);

    expect(useCompareMock).toHaveBeenCalledWith(
      "plataforma",
      undefined,
      expect.anything(),
      "province",
    );
    expect(screen.getByText("Comparativa")).toBeInTheDocument();
    expect(screen.getByText("Bidasoa")).toBeInTheDocument();
  });

  it("Comparativa: cambiar el `<select>` a «Comarca» pide el desglose 'comarca'", async () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: [] }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
    });
    mockCompare();
    const user = userEvent.setup();

    render(<PlataformaMetricasPage />);
    await user.selectOptions(screen.getByLabelText("Desglose de la comparativa"), "Comarca");

    expect(useCompareMock).toHaveBeenLastCalledWith(
      "plataforma",
      undefined,
      expect.anything(),
      "comarca",
    );
  });

  it("plurianual: elegir el preset cambia la serie a anual y a group_by='year'", async () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    mockMetricsByGroup({
      base: buildMetricsResponse(),
      place: buildMetricsResponse({ by_place: [] }),
      organization: buildMetricsResponse({ by_place: [] }),
      month: buildMetricsResponse({ series: [] }),
      year: buildMetricsResponse({ series: [{ year: "2025", events: 5, people: 13, suppressed: false }] }),
    });
    mockCompare();
    const user = userEvent.setup();

    render(<PlataformaMetricasPage />);
    expect(screen.getByText("Serie mensual")).toBeInTheDocument();

    // Dos `PeriodSelector` en la página (el del dashboard y el de
    // `ExportPanel`, más abajo): el primero es el del dashboard.
    await user.click(screen.getAllByRole("button", { name: "Plurianual" })[0]);

    expect(screen.getByText("Serie anual")).toBeInTheDocument();
    expect(useMetricsMock).toHaveBeenLastCalledWith("plataforma", undefined, expect.anything(), "year");
  });
});
