import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildProgram } from "@/test-utils/fixtures/program";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useProgramsMock = vi.hoisted(() => vi.fn());
const useCreateProgramMock = vi.hoisted(() => vi.fn());
const useUpdateProgramMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/usePrograms", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePrograms")>("@/hooks/usePrograms");
  return { ...actual, usePrograms: useProgramsMock };
});
vi.mock("@/hooks/useProgramMutations", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProgramMutations")>(
    "@/hooks/useProgramMutations",
  );
  return { ...actual, useCreateProgram: useCreateProgramMock, useUpdateProgram: useUpdateProgramMock };
});

import EntidadProgramasPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useProgramsMock.mockReset();
  useCreateProgramMock.mockReset();
  useUpdateProgramMock.mockReset();
});

function mockDefaults() {
  useCreateProgramMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });
  useUpdateProgramMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });
}

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadProgramasPage({ params: Promise.resolve({ slug }) });
  return render(element);
}

describe("EntidadProgramasPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Programas");
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockDefaults();
    useProgramsMock.mockReturnValue({
      data: [buildProgram({ name: "Refuerzo escolar" })],
      isError: false,
      error: null,
    });

    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("titular ve la lista y el botón «Nuevo programa»", async () => {
    mockDefaults();
    useProgramsMock.mockReturnValue({
      data: [buildProgram({ id: 5, name: "Refuerzo escolar" })],
      isError: false,
      error: null,
    });

    await renderPage("titular");

    expect(screen.getByRole("heading", { name: "Programas", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Refuerzo escolar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo programa" })).toBeInTheDocument();
  });

  it("crear un programa manda los campos con budget_cents", async () => {
    const mutate = vi.fn();
    mockDefaults();
    useCreateProgramMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });
    useProgramsMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Nuevo programa" }));
    await user.type(screen.getByLabelText("Nombre"), "Refuerzo escolar");
    await user.type(screen.getByLabelText("Inicio"), "2026-01-01");
    await user.type(screen.getByLabelText("Fin"), "2026-06-30");
    await user.type(screen.getByLabelText("Presupuesto (€)"), "500");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Refuerzo escolar", budget_cents: 50000 }),
      expect.anything(),
    );
  });

  it("dinamizador ve la lista pero no «Nuevo programa»", async () => {
    mockDefaults();
    useProgramsMock.mockReturnValue({
      data: [buildProgram({ name: "Refuerzo escolar" })],
      isError: false,
      error: null,
    });

    await renderPage("dinamizador");

    expect(screen.getByText("Refuerzo escolar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo programa" })).not.toBeInTheDocument();
  });

  it("analista ve la lista, sin gestión", async () => {
    mockDefaults();
    useProgramsMock.mockReturnValue({ data: [], isError: false, error: null });

    await renderPage("analista");

    expect(screen.getByRole("heading", { name: "Programas", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo programa" })).not.toBeInTheDocument();
  });

  it("referente ve la sección (ver_panel le basta)", async () => {
    mockDefaults();
    useProgramsMock.mockReturnValue({ data: [], isError: false, error: null });

    await renderPage("referente");

    expect(screen.getByRole("heading", { name: "Programas", level: 1 })).toBeInTheDocument();
  });

  it("sin recursos muestra el estado vacío", async () => {
    mockDefaults();
    useProgramsMock.mockReturnValue({ data: [], isError: false, error: null });

    await renderPage("titular");

    expect(screen.getByText("Sin programas todavía")).toBeInTheDocument();
  });

  it("estado de error pinta ErrorState", async () => {
    mockDefaults();
    useProgramsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar los programas."),
    });

    await renderPage("titular");

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar los programas");
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadProgramasPage({ params: Promise.resolve({ slug: "alfaville" }) }),
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
      EntidadProgramasPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
