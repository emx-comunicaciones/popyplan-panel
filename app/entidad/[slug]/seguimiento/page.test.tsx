import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextNotFoundSignal, NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildEnrollment } from "@/test-utils/fixtures/tracking";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const isTrackingProgramEnabledMock = vi.hoisted(() => vi.fn());
const useEnrollmentsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth/organization", () => ({ isTrackingProgramEnabled: isTrackingProgramEnabledMock }));
vi.mock("@/hooks/useProgramEnrollments", () => ({ useEnrollments: useEnrollmentsMock }));

import EntidadSeguimientoPage, { generateMetadata } from "./page";

beforeEach(() => {
  isTrackingProgramEnabledMock.mockResolvedValue(true);
  useEnrollmentsMock.mockReturnValue({
    data: [
      buildEnrollment(),
      buildEnrollment({
        id: 2,
        user: { id: 14, public_name: "Persona 02" },
        status: "active",
        tracking_type: "other",
        tracking_label: "Pantallas",
        referent: null,
      }),
    ],
    isError: false,
    error: null,
  });
});

afterEach(() => {
  getServerSessionMock.mockReset();
  isTrackingProgramEnabledMock.mockReset();
  useEnrollmentsMock.mockReset();
});

async function renderPage(role = "titular", slug = "asociacion-bidasoa") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 96 })],
    }),
    platformRole: { role: null },
  });
  const element = await EntidadSeguimientoPage({ params: Promise.resolve({ slug }) });
  return render(element);
}

describe("EntidadSeguimientoPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await renderPage();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Programa de seguimiento");
  });

  it("lista estado, tipo y referente de cada inscripción, con enlace a la ficha", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { name: "Programa de seguimiento" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Persona 01" })).toHaveAttribute(
      "href",
      "/entidad/asociacion-bidasoa/personas/13",
    );
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Pendiente de aceptar")).toBeInTheDocument();
    expect(table.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Otro: Pantallas")).toBeInTheDocument();
    expect(screen.getByText("Sin referente")).toBeInTheDocument();
    expect(screen.getByText(/solo los ve el referente asignado/)).toBeInTheDocument();
  });

  it("filtra por estado", async () => {
    await renderPage("moderador");
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "active");
    expect(useEnrollmentsMock).toHaveBeenLastCalledWith(96, { status: "active" });
  });

  it("vacío, cargando y error", async () => {
    useEnrollmentsMock.mockReturnValue({ data: [], isError: false, error: null });
    const empty = await renderPage();
    expect(screen.getByText("No hay inscripciones con este filtro.")).toBeInTheDocument();
    empty.unmount();

    useEnrollmentsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    const loading = await renderPage();
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    loading.unmount();

    useEnrollmentsMock.mockReturnValue({ data: undefined, isError: true, error: { kind: "desconocido", message: "" } });
    await renderPage();
    expect(screen.getByText("No se pudo cargar el programa")).toBeInTheDocument();
  });

  it.each(["dinamizador", "analista", "referente"])("%s recibe notFound (no se revela el programa)", async (role) => {
    await expect(renderPage(role)).rejects.toBeInstanceOf(NextNotFoundSignal);
  });

  it("titular sin el servicio encendido también recibe notFound", async () => {
    isTrackingProgramEnabledMock.mockResolvedValue(false);
    await expect(renderPage("titular")).rejects.toBeInstanceOf(NextNotFoundSignal);
  });

  it("sin sesión va a /login y sin membresía a /", async () => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(EntidadSeguimientoPage({ params: Promise.resolve({ slug: "x" }) })).rejects.toBeInstanceOf(
      NextRedirectSignal,
    );

    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: { role: null },
    });
    await expect(EntidadSeguimientoPage({ params: Promise.resolve({ slug: "x" }) })).rejects.toBeInstanceOf(
      NextRedirectSignal,
    );
  });
});
