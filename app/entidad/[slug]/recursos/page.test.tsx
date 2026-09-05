import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildEntityResource } from "@/test-utils/fixtures/resource";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useResourcesMock = vi.hoisted(() => vi.fn());
const useCreateResourceMock = vi.hoisted(() => vi.fn());
const useUpdateResourceMock = vi.hoisted(() => vi.fn());
const useDeleteResourceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useResources", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useResources")>("@/hooks/useResources");
  return { ...actual, useResources: useResourcesMock };
});
vi.mock("@/hooks/useCreateResource", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCreateResource")>(
    "@/hooks/useCreateResource",
  );
  return { ...actual, useCreateResource: useCreateResourceMock };
});
vi.mock("@/hooks/useUpdateResource", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useUpdateResource")>(
    "@/hooks/useUpdateResource",
  );
  return { ...actual, useUpdateResource: useUpdateResourceMock };
});
vi.mock("@/hooks/useDeleteResource", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useDeleteResource")>(
    "@/hooks/useDeleteResource",
  );
  return { ...actual, useDeleteResource: useDeleteResourceMock };
});

import EntidadRecursosPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useResourcesMock.mockReset();
  useCreateResourceMock.mockReset();
  useUpdateResourceMock.mockReset();
  useDeleteResourceMock.mockReset();
});

function mockDefaults() {
  useCreateResourceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });
  useUpdateResourceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });
  useDeleteResourceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });
}

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadRecursosPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadRecursosPage", () => {
  it("titular ve la lista agrupada por categoría con destacados y el botón de nuevo recurso", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({
      data: [
        buildEntityResource({ id: 1, title: "Guía de acogida", category: "help" }),
        buildEntityResource({ id: 2, title: "Curso de formación", category: "training", is_featured: true }),
      ],
      isError: false,
      error: null,
    });

    await renderPage("titular");

    expect(screen.getByRole("heading", { name: "Recursos", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ayuda" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Formación" })).toBeInTheDocument();
    expect(screen.getByText("Guía de acogida")).toBeInTheDocument();
    expect(screen.getByText("Curso de formación")).toBeInTheDocument();
    expect(screen.getByText("Destacado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo recurso" })).toBeInTheDocument();
  });

  it("crear un recurso de tipo texto manda category/kind/audience/body", async () => {
    const mutate = vi.fn();
    mockDefaults();
    useCreateResourceMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });
    useResourcesMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Nuevo recurso" }));
    await user.type(screen.getByLabelText("Título"), "Guía de acogida");
    await user.type(screen.getByLabelText("Texto"), "Bienvenida");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Guía de acogida",
        category: "help",
        kind: "text",
        audience: "members",
        body: "Bienvenida",
      }),
      expect.anything(),
    );
  });

  it("elegir tipo PDF muestra el campo de fichero y valida la extensión", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Nuevo recurso" }));
    await user.selectOptions(screen.getByLabelText("Tipo"), "pdf");

    const fileInput = screen.getByLabelText("Fichero") as HTMLInputElement;
    const badFile = new File(["x"], "virus.exe", { type: "application/octet-stream" });
    await user.upload(fileInput, badFile);

    expect(screen.getByText(/Tipo de fichero no permitido/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("la audiencia 'Familias' está deshabilitada", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");
    await user.click(screen.getByRole("button", { name: "Nuevo recurso" }));

    const audienceSelect = screen.getByLabelText("Audiencia") as HTMLSelectElement;
    const familiesOption = Array.from(audienceSelect.options).find((o) => o.value === "families");
    expect(familiesOption?.disabled).toBe(true);
  });

  it("editar un recurso precarga el formulario y guarda solo los cambios", async () => {
    const mutate = vi.fn();
    mockDefaults();
    useUpdateResourceMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });
    useResourcesMock.mockReturnValue({
      data: [buildEntityResource({ id: 1, title: "Guía de acogida", category: "help", kind: "text" })],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByDisplayValue("Guía de acogida")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 1, title: "Guía de acogida" }),
      expect.anything(),
    );
  });

  it("eliminar pide confirmación antes de llamar a la mutación", async () => {
    const mutate = vi.fn();
    mockDefaults();
    useDeleteResourceMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });
    useResourcesMock.mockReturnValue({
      data: [buildEntityResource({ id: 1, title: "Guía de acogida" })],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));

    expect(mutate).toHaveBeenCalledWith(1, expect.anything());
  });

  it("moderador también gestiona recursos", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({ data: [], isError: false, error: null });

    await renderPage("moderador");

    expect(screen.getByRole("button", { name: "Nuevo recurso" })).toBeInTheDocument();
  });

  it("dinamizador solo ve la lista, sin gestión", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({
      data: [buildEntityResource({ id: 1, title: "Guía de acogida" })],
      isError: false,
      error: null,
    });

    await renderPage("dinamizador");

    expect(screen.queryByRole("button", { name: "Nuevo recurso" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.getByText("Guía de acogida")).toBeInTheDocument();
  });

  it("sin recursos muestra el estado vacío", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({ data: [], isError: false, error: null });

    await renderPage("titular");

    expect(screen.getByText("Sin recursos todavía")).toBeInTheDocument();
  });

  it("estado de error pinta ErrorState", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar los recursos."),
    });

    await renderPage("titular");

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar los recursos");
  });

  it("analista ve «Sin acceso»", async () => {
    await renderPage("analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadRecursosPage({ params: Promise.resolve({ slug: "alfaville" }) }),
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
      EntidadRecursosPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
