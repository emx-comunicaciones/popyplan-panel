import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { render, screen } from "@/test-utils/render";
import {
  buildByOrganizationRows,
  buildByPlaceRows,
  buildMetricsResponse,
  buildSeriesRows,
} from "@/test-utils/fixtures/metrics";
import type { MetricsGroupBy, MetricsScope } from "@/hooks/useMetrics";
import { MetricsError } from "@/hooks/useMetrics";

const useMetricsMock = vi.hoisted(() => vi.fn());
const useExportMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useMetrics", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useMetrics")>("@/hooks/useMetrics");
  return { ...actual, useMetrics: useMetricsMock };
});
vi.mock("@/hooks/useExport", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useExport")>("@/hooks/useExport");
  return { ...actual, useExport: useExportMock };
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

afterEach(() => {
  useMetricsMock.mockReset();
  useExportMock.mockReset();
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

    render(<PlataformaMetricasPage />);

    expect(screen.getByText("Sin datos para este periodo")).toBeInTheDocument();
    expect(screen.getByText("Sin datos suficientes para la serie mensual")).toBeInTheDocument();
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

    render(<PlataformaMetricasPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las métricas");
    expect(screen.getByText("No tienes acceso a estas métricas.")).toBeInTheDocument();
  });
});
