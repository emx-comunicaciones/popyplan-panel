import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildReportDetail } from "@/test-utils/fixtures/report";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useReportMock = vi.hoisted(() => vi.fn());
const useAssignReportMock = vi.hoisted(() => vi.fn());
const useResolveReportMock = vi.hoisted(() => vi.fn());
const useEscalateReportMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useReport", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useReport")>("@/hooks/useReport");
  return { ...actual, useReport: useReportMock };
});
vi.mock("@/hooks/useReportActions", () => ({
  useAssignReport: useAssignReportMock,
  useResolveReport: useResolveReportMock,
  useEscalateReport: useEscalateReportMock,
}));

import EntidadReporteDetailPage, { generateMetadata } from "./page";

function idleMutation() {
  return { mutate: vi.fn(), isPending: false, isError: false };
}

afterEach(() => {
  getServerSessionMock.mockReset();
  useReportMock.mockReset();
  useAssignReportMock.mockReset();
  useResolveReportMock.mockReset();
  useEscalateReportMock.mockReset();
});

async function renderPage(role = "titular", slug = "alfaville", reportId = "r1") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadReporteDetailPage({ params: Promise.resolve({ slug, reportId }) });
  render(element);
}

describe("EntidadReporteDetailPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Detalle de reporte (entidad)");
  });

  it("muestra los datos del reporte y el botón Asignarme cuando no hay asignado", async () => {
    useReportMock.mockReturnValue({ data: buildReportDetail({ assigned_to: null }), isError: false, error: null });
    useAssignReportMock.mockReturnValue(idleMutation());
    useResolveReportMock.mockReturnValue(idleMutation());
    useEscalateReportMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.getByRole("heading", { name: "Reporte" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Asignarme" })).toBeInTheDocument();
  });

  it("pinta el motivo y el estado en castellano, no el valor del contrato", async () => {
    useReportMock.mockReturnValue({
      data: buildReportDetail({ reason: "self_harm_risk", status: "in_review", assigned_to: null }),
      isError: false,
      error: null,
    });
    useAssignReportMock.mockReturnValue(idleMutation());
    useResolveReportMock.mockReturnValue(idleMutation());
    useEscalateReportMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.getByText("Riesgo de autolesión")).toBeInTheDocument();
    expect(screen.getByText("En revisión")).toBeInTheDocument();
    expect(screen.queryByText("self_harm_risk")).not.toBeInTheDocument();
    expect(screen.queryByText("in_review")).not.toBeInTheDocument();
  });

  it("con reporte asignado no enseña el id suelto de la persona", async () => {
    useReportMock.mockReturnValue({
      data: buildReportDetail({ assigned_to: 9 }),
      isError: false,
      error: null,
    });
    useAssignReportMock.mockReturnValue(idleMutation());
    useResolveReportMock.mockReturnValue(idleMutation());
    useEscalateReportMock.mockReturnValue(idleMutation());

    await renderPage();

    // `ReportDetail.assigned_to` es un id suelto (`number | null`), sin
    // nombre: el panel nunca pinta ids de cuenta (invariante 1/9).
    expect(screen.getByText("Asignado a una persona del equipo")).toBeInTheDocument();
    expect(screen.queryByText("9")).not.toBeInTheDocument();
  });

  it("sin asignar lo dice explícitamente", async () => {
    useReportMock.mockReturnValue({
      data: buildReportDetail({ assigned_to: null }),
      isError: false,
      error: null,
    });
    useAssignReportMock.mockReturnValue(idleMutation());
    useResolveReportMock.mockReturnValue(idleMutation());
    useEscalateReportMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.getByText("Sin asignar")).toBeInTheDocument();
  });

  it("resolver llama a la mutación con resolution y note", async () => {
    const resolveMutate = vi.fn();
    useReportMock.mockReturnValue({ data: buildReportDetail({ assigned_to: 9 }), isError: false, error: null });
    useAssignReportMock.mockReturnValue(idleMutation());
    useResolveReportMock.mockReturnValue({ mutate: resolveMutate, isPending: false, isError: false });
    useEscalateReportMock.mockReturnValue(idleMutation());
    const user = userEvent.setup();

    await renderPage();
    await user.selectOptions(screen.getByLabelText("Resolución"), "warned");
    await user.type(screen.getByLabelText("Nota de resolución"), "Primer aviso");
    await user.click(screen.getByRole("button", { name: "Resolver" }));

    expect(resolveMutate).toHaveBeenCalledWith({
      reportId: "r1",
      resolution: "warned",
      note: "Primer aviso",
    });
  });

  it("escalar llama a la mutación con la nota", async () => {
    const escalateMutate = vi.fn();
    useReportMock.mockReturnValue({ data: buildReportDetail({ assigned_to: 9 }), isError: false, error: null });
    useAssignReportMock.mockReturnValue(idleMutation());
    useResolveReportMock.mockReturnValue(idleMutation());
    useEscalateReportMock.mockReturnValue({ mutate: escalateMutate, isPending: false, isError: false });
    const user = userEvent.setup();

    await renderPage();
    await user.type(screen.getByLabelText("Nota para plataforma"), "Necesita plataforma");
    await user.click(screen.getByRole("button", { name: "Escalar" }));

    expect(escalateMutate).toHaveBeenCalledWith({ reportId: "r1", note: "Necesita plataforma" });
  });

  it("un reporte ya resuelto no muestra los formularios de acción", async () => {
    useReportMock.mockReturnValue({
      data: buildReportDetail({ status: "resolved", assigned_to: 9 }),
      isError: false,
      error: null,
    });
    useAssignReportMock.mockReturnValue(idleMutation());
    useResolveReportMock.mockReturnValue(idleMutation());
    useEscalateReportMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.queryByRole("button", { name: "Resolver" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Escalar" })).not.toBeInTheDocument();
  });

  it("sin acceso (403) muestra «Sin acceso»", async () => {
    const { ReportError } = await import("@/hooks/useReport");
    useReportMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new ReportError("sin_acceso", "No tienes acceso a este reporte."),
    });
    useAssignReportMock.mockReturnValue(idleMutation());
    useResolveReportMock.mockReturnValue(idleMutation());
    useEscalateReportMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("dinamizador no ve Reportes: «Sin acceso» a nivel de página", async () => {
    useReportMock.mockReturnValue({ data: buildReportDetail(), isError: false, error: null });
    useAssignReportMock.mockReturnValue(idleMutation());
    useResolveReportMock.mockReturnValue(idleMutation());
    useEscalateReportMock.mockReturnValue(idleMutation());

    await renderPage("dinamizador");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadReporteDetailPage({ params: Promise.resolve({ slug: "alfaville", reportId: "r1" }) }),
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
      EntidadReporteDetailPage({ params: Promise.resolve({ slug: "otra-entidad", reportId: "r1" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
