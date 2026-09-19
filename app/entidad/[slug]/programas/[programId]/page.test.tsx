import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildMetricsResponse } from "@/test-utils/fixtures/metrics";
import { buildProgram } from "@/test-utils/fixtures/program";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useProgramMock = vi.hoisted(() => vi.fn());
const useActivateProgramMock = vi.hoisted(() => vi.fn());
const useCloseProgramMock = vi.hoisted(() => vi.fn());
const useProgramReportMock = vi.hoisted(() => vi.fn());
const useMetricsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
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

import EntidadProgramaPage, { generateMetadata } from "./page";

function mutationDefaults() {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null };
}

function mockDefaults() {
  useActivateProgramMock.mockReturnValue(mutationDefaults());
  useCloseProgramMock.mockReturnValue(mutationDefaults());
  useProgramReportMock.mockReturnValue(mutationDefaults());
  useMetricsMock.mockReturnValue({ data: buildMetricsResponse(), isError: false, error: null });
}

afterEach(() => {
  getServerSessionMock.mockReset();
  useProgramMock.mockReset();
  useActivateProgramMock.mockReset();
  useCloseProgramMock.mockReset();
  useProgramReportMock.mockReset();
  useMetricsMock.mockReset();
});

async function renderPage(role = "titular", slug = "alfaville", programId = "5") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadProgramaPage({ params: Promise.resolve({ slug, programId }) });
  return render(element);
}

describe("EntidadProgramaPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Ficha del programa");
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockDefaults();
    useProgramMock.mockReturnValue({ data: buildProgram(), isError: false, error: null });

    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("titular ve el nombre del programa, activar/editar y descargar informe", async () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({ name: "Refuerzo escolar", status: "draft" }),
      isError: false,
      error: null,
    });

    await renderPage("titular");

    expect(screen.getByRole("heading", { name: "Ficha del programa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Refuerzo escolar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar informe CSV" })).toBeInTheDocument();
  });

  it("dinamizador ve la ficha sin gestión ni exportación", async () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({ name: "Refuerzo escolar", status: "draft" }),
      isError: false,
      error: null,
    });

    await renderPage("dinamizador");

    expect(screen.getByRole("heading", { name: "Refuerzo escolar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descargar informe CSV" })).not.toBeInTheDocument();
  });

  it("analista no gestiona, pero sí descarga el informe (exportar_informes)", async () => {
    mockDefaults();
    useProgramMock.mockReturnValue({
      data: buildProgram({ name: "Refuerzo escolar", status: "draft" }),
      isError: false,
      error: null,
    });

    await renderPage("analista");

    expect(screen.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar informe CSV" })).toBeInTheDocument();
  });

  it("referente no gestiona ni exporta", async () => {
    mockDefaults();
    useProgramMock.mockReturnValue({ data: buildProgram({ status: "draft" }), isError: false, error: null });

    await renderPage("referente");

    expect(screen.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descargar informe CSV" })).not.toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadProgramaPage({ params: Promise.resolve({ slug: "alfaville", programId: "5" }) }),
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
      EntidadProgramaPage({ params: Promise.resolve({ slug: "otra-entidad", programId: "5" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
