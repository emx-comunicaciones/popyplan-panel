import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { buildProgram } from "@/test-utils/fixtures/program";
import { buildMetricsResponse } from "@/test-utils/fixtures/metrics";

const useProgramMock = vi.hoisted(() => vi.fn());
const useActivateProgramMock = vi.hoisted(() => vi.fn());
const useCloseProgramMock = vi.hoisted(() => vi.fn());
const useProgramReportMock = vi.hoisted(() => vi.fn());
const useMetricsMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useProgram", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProgram")>("@/hooks/useProgram");
  return { ...actual, useProgram: useProgramMock };
});
vi.mock("@/hooks/useProgramMutations", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProgramMutations")>(
    "@/hooks/useProgramMutations",
  );
  return {
    ...actual,
    useActivateProgram: useActivateProgramMock,
    useCloseProgram: useCloseProgramMock,
  };
});
vi.mock("@/hooks/useProgramReport", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProgramReport")>(
    "@/hooks/useProgramReport",
  );
  return { ...actual, useProgramReport: useProgramReportMock };
});
vi.mock("@/hooks/useMetrics", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useMetrics")>("@/hooks/useMetrics");
  return { ...actual, useMetrics: useMetricsMock };
});

import { ProgramaDetalle } from "./ProgramaDetalle";

function mutationDefaults(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null, ...overrides };
}

function mockDefaults() {
  useActivateProgramMock.mockReturnValue(mutationDefaults());
  useCloseProgramMock.mockReturnValue(mutationDefaults());
  useProgramReportMock.mockReturnValue(mutationDefaults());
  useMetricsMock.mockReturnValue({ data: buildMetricsResponse(), isError: false, error: null });
}

afterEach(() => {
  useProgramMock.mockReset();
  useActivateProgramMock.mockReset();
  useCloseProgramMock.mockReset();
  useProgramReportMock.mockReset();
  useMetricsMock.mockReset();
});

describe("ProgramaDetalle", () => {
  it("cargando: muestra el mensaje de carga", () => {
    useProgramMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport />);

    expect(screen.getByText("Cargando programa…")).toBeInTheDocument();
  });

  it("error: muestra ErrorState con el mensaje del hook", () => {
    useProgramMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("Este programa no existe."),
    });

    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport />);

    expect(screen.getByRole("alert")).toHaveTextContent("Este programa no existe.");
  });

  it("pinta nombre, estado, fechas, financiador y presupuesto formateado es-ES", () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({
        name: "Refuerzo escolar",
        status: "active",
        funder: "Diputación Foral",
        budget_cents: 500000,
      }),
      isError: false,
      error: null,
    });

    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport />);

    expect(screen.getByRole("heading", { name: "Refuerzo escolar" })).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
    expect(screen.getByText(/Diputación Foral/)).toBeInTheDocument();
    expect(screen.getByText("5.000,00 €", { exact: false })).toBeInTheDocument();
  });

  it("draft: ve «Activar», no «Cerrar programa»", () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({ status: "draft" }),
      isError: false,
      error: null,
    });

    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport />);

    expect(screen.getByRole("button", { name: "Activar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar programa" })).not.toBeInTheDocument();
  });

  it("«Activar» llama a mutate con el id del programa", async () => {
    mockDefaults();
    const mutate = vi.fn();
    useActivateProgramMock.mockReturnValue(mutationDefaults({ mutate }));
    useProgramMock.mockReturnValue({
      data: buildProgram({ id: 9, status: "draft" }),
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<ProgramaDetalle orgId={7} programId={9} canManage canExport />);

    await user.click(screen.getByRole("button", { name: "Activar" }));

    expect(mutate).toHaveBeenCalledWith(9);
  });

  it("active: ve «Cerrar programa», no «Activar»", () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({ status: "active" }),
      isError: false,
      error: null,
    });

    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport />);

    expect(screen.getByRole("button", { name: "Cerrar programa" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
  });

  it("«Cerrar programa» pide confirmación con notas de cierre y manda closingNotes", async () => {
    mockDefaults();
    const mutate = vi.fn();
    useCloseProgramMock.mockReturnValue(mutationDefaults({ mutate }));
    useProgramMock.mockReturnValue({
      data: buildProgram({ id: 9, status: "active" }),
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<ProgramaDetalle orgId={7} programId={9} canManage canExport />);

    await user.click(screen.getByRole("button", { name: "Cerrar programa" }));
    const dialog = screen.getByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Notas de cierre"), "Cerrado con éxito");
    await user.click(within(dialog).getByRole("button", { name: "Cerrar programa" }));

    expect(mutate).toHaveBeenCalledWith(
      { programId: 9, closingNotes: "Cerrado con éxito" },
      expect.anything(),
    );
  });

  it("closed: no ve Editar/Activar/Cerrar, pero sí las notas de cierre", () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({ status: "closed", closing_notes: "Todo fue bien" }),
      isError: false,
      error: null,
    });

    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport />);

    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar programa" })).not.toBeInTheDocument();
    expect(screen.getByText(/Todo fue bien/)).toBeInTheDocument();
  });

  it("canManage=false: no ve Editar/Activar/Cerrar", () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({ status: "draft" }),
      isError: false,
      error: null,
    });

    render(<ProgramaDetalle orgId={7} programId={3} canManage={false} canExport />);

    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
  });

  it("canExport=false: no ve los botones de descargar informe", () => {
    mockDefaults();
    useProgramMock.mockReturnValue({ data: buildProgram(), isError: false, error: null });

    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport={false} />);

    expect(screen.queryByRole("button", { name: "Descargar informe CSV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descargar informe PDF" })).not.toBeInTheDocument();
  });

  it("«Descargar informe CSV/PDF» llama a mutate con format", async () => {
    mockDefaults();
    const mutate = vi.fn();
    useProgramReportMock.mockReturnValue(mutationDefaults({ mutate }));
    useProgramMock.mockReturnValue({
      data: buildProgram({ id: 9 }),
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<ProgramaDetalle orgId={7} programId={9} canManage canExport />);

    await user.click(screen.getByRole("button", { name: "Descargar informe CSV" }));
    expect(mutate).toHaveBeenCalledWith({ orgId: 7, programId: 9, format: "csv" });

    await user.click(screen.getByRole("button", { name: "Descargar informe PDF" }));
    expect(mutate).toHaveBeenCalledWith({ orgId: 7, programId: 9, format: "pdf" });
  });

  it("«Editar» abre el diálogo con el formulario precargado", async () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({ name: "Refuerzo escolar", status: "draft" }),
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport />);

    await user.click(screen.getByRole("button", { name: "Editar" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Refuerzo escolar");
  });

  it("las métricas del periodo usan useMetrics con el rango del programa y group_by=month", () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({ starts_on: "2026-01-01", ends_on: "2026-06-30" }),
      isError: false,
      error: null,
    });

    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport />);

    expect(useMetricsMock).toHaveBeenCalledWith(
      "entidad",
      7,
      { since: "2026-01-01", until: "2026-06-30" },
      "month",
    );
    expect(screen.getByText("Métricas del periodo")).toBeInTheDocument();
  });

  it("error de métricas: muestra ErrorState en esa sección", () => {
    mockDefaults();
    useMetricsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar las métricas."),
    });
    useProgramMock.mockReturnValue({ data: buildProgram(), isError: false, error: null });

    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport />);

    expect(screen.getAllByRole("alert").some((el) => el.textContent?.includes("métricas"))).toBe(true);
  });
});
