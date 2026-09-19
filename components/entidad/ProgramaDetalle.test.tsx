import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRenderUnwrapped } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, render, screen, within } from "@/test-utils/render";
import { buildProgram } from "@/test-utils/fixtures/program";
import { buildMetricsResponse } from "@/test-utils/fixtures/metrics";
import { MetricsError } from "@/hooks/useMetrics";
import eu from "@/messages/eu.json";

const useProgramMock = vi.hoisted(() => vi.fn());
const useActivateProgramMock = vi.hoisted(() => vi.fn());
const useCloseProgramMock = vi.hoisted(() => vi.fn());
const useCreateProgramMock = vi.hoisted(() => vi.fn());
const useUpdateProgramMock = vi.hoisted(() => vi.fn());
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
    useCreateProgram: useCreateProgramMock,
    useUpdateProgram: useUpdateProgramMock,
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
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    ...overrides,
  };
}

function mockDefaults() {
  useActivateProgramMock.mockReturnValue(mutationDefaults());
  useCloseProgramMock.mockReturnValue(mutationDefaults());
  useProgramReportMock.mockReturnValue(mutationDefaults());
  useCreateProgramMock.mockReturnValue(mutationDefaults());
  useUpdateProgramMock.mockReturnValue(mutationDefaults());
  useMetricsMock.mockReturnValue({ data: buildMetricsResponse(), isError: false, error: null });
}

afterEach(() => {
  useProgramMock.mockReset();
  useActivateProgramMock.mockReset();
  useCloseProgramMock.mockReset();
  useProgramReportMock.mockReset();
  useCreateProgramMock.mockReset();
  useUpdateProgramMock.mockReset();
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
      error: { message: "Este programa no existe.", kind: "no_encontrado" },
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

  it("el error de cerrar programa se pinta dentro del diálogo, que sigue abierto", async () => {
    mockDefaults();
    useCloseProgramMock.mockReturnValue(
      mutationDefaults({
        isError: true,
        error: {
          message: "Un programa cerrado no se modifica.",
          kind: "conflicto",
          detail: "Un programa cerrado no se modifica.",
        },
      }),
    );
    useProgramMock.mockReturnValue({
      data: buildProgram({ id: 9, status: "active" }),
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<ProgramaDetalle orgId={7} programId={9} canManage canExport />);

    await user.click(screen.getByRole("button", { name: "Cerrar programa" }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Un programa cerrado no se modifica.",
    );
  });

  it("abrir el diálogo de cierre limpia el error del intento anterior", async () => {
    mockDefaults();
    const reset = vi.fn();
    useCloseProgramMock.mockReturnValue(mutationDefaults({ reset }));
    useProgramMock.mockReturnValue({
      data: buildProgram({ id: 9, status: "active" }),
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<ProgramaDetalle orgId={7} programId={9} canManage canExport />);

    await user.click(screen.getByRole("button", { name: "Cerrar programa" }));

    expect(reset).toHaveBeenCalled();
  });

  it("con el guardado del formulario en vuelo, Escape no cierra el diálogo de edición", async () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({ name: "Refuerzo escolar", status: "draft" }),
      isError: false,
      error: null,
    });

    // `ProgramaForm` avisa hacia arriba de que su mutación está en vuelo
    // (`onPendingChange`) para que el diálogo que lo envuelve no se pueda
    // cerrar con el `PATCH` a medias.
    useUpdateProgramMock.mockReturnValue(mutationDefaults({ isPending: true }));

    const user = userEvent.setup();
    render(<ProgramaDetalle orgId={7} programId={3} canManage canExport />);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("informe PDF no disponible (503) con detalle del backend muestra ese texto tal cual", async () => {
    const { ProgramReportError } = await import("@/hooks/useProgramReport");
    mockDefaults();
    useProgramReportMock.mockReturnValue(
      mutationDefaults({
        isError: true,
        error: new ProgramReportError(
          "pdf_unavailable",
          "Exportación PDF no disponible en este entorno.",
          "Exportación PDF no disponible en este entorno.",
        ),
      }),
    );
    useProgramMock.mockReturnValue({ data: buildProgram({ id: 9 }), isError: false, error: null });

    render(<ProgramaDetalle orgId={7} programId={9} canManage canExport />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Exportación PDF no disponible en este entorno.",
    );
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

  it("error de métricas con kind 'sin_acceso': traduce con errorKindText (eu), no pinta el `.message` en español", () => {
    mockDefaults();
    useMetricsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new MetricsError("sin_acceso", "No tienes acceso a estas métricas."),
    });
    useProgramMock.mockReturnValue({ data: buildProgram(), isError: false, error: null });

    const queryClient = createTestQueryClient();
    rtlRenderUnwrapped(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="eu" messages={eu}>
          <ProgramaDetalle orgId={7} programId={3} canManage canExport />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    expect(
      screen
        .getAllByRole("alert")
        .some((el) => el.textContent?.includes("Ez duzu metrika hauetarako sarbiderik.")),
    ).toBe(true);
    expect(
      screen.queryAllByText((_, el) => el?.textContent === "No tienes acceso a estas métricas." || false),
    ).toHaveLength(0);
  });
});
