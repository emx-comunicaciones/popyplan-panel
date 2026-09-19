import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildEntityResource } from "@/test-utils/fixtures/resource";
import { buildEntityCommunityRow } from "@/test-utils/fixtures/community";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useResourcesMock = vi.hoisted(() => vi.fn());
const useCreateResourceMock = vi.hoisted(() => vi.fn());
const useUpdateResourceMock = vi.hoisted(() => vi.fn());
const useDeleteResourceMock = vi.hoisted(() => vi.fn());
const useEntityCommunitiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useResources", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useResources")>("@/hooks/useResources");
  return { ...actual, useResources: useResourcesMock };
});
vi.mock("@/hooks/useEntityCommunities", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useEntityCommunities")>(
    "@/hooks/useEntityCommunities",
  );
  return { ...actual, useEntityCommunities: useEntityCommunitiesMock };
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

import EntidadRecursosPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useResourcesMock.mockReset();
  useCreateResourceMock.mockReset();
  useUpdateResourceMock.mockReset();
  useDeleteResourceMock.mockReset();
  useEntityCommunitiesMock.mockReset();
});

function mockDefaults() {
  useCreateResourceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });
  useUpdateResourceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });
  useDeleteResourceMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  });
  useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
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
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Recursos");
  });

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

  it("un recurso de categoría 'accompany' aparece bajo «Cómo acompañar» tras «Familias», y el select la ofrece", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({
      data: [
        buildEntityResource({ id: 1, title: "Guía para acompañantes", category: "accompany" }),
        buildEntityResource({ id: 2, title: "Recurso de familias", category: "families" }),
      ],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf("Familias")).toBeLessThan(headings.indexOf("Cómo acompañar"));
    expect(screen.getByText("Guía para acompañantes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nuevo recurso" }));
    const categorySelect = screen.getByLabelText("Categoría") as HTMLSelectElement;
    expect(
      Array.from(categorySelect.options).some((o) => o.value === "accompany" && o.text === "Cómo acompañar"),
    ).toBe(true);
  });

  it("si las comunidades fallan, el formulario lo avisa bajo «Audiencia»", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar las comunidades de la entidad."),
    });
    const user = userEvent.setup();

    await renderPage("titular");
    await user.click(screen.getByRole("button", { name: "Nuevo recurso" }));

    expect(screen.getByText("No se pudieron cargar las comunidades.")).toBeInTheDocument();
    expect(
      screen.queryByText("«Familias» estará disponible cuando exista el espacio de familias."),
    ).not.toBeInTheDocument();
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

  it("con una comunidad de familias, la audiencia 'Familias' está habilitada", async () => {
    const mutate = vi.fn();
    mockDefaults();
    useCreateResourceMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });
    useResourcesMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c-1", name: "Familias", space: "families" })],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");
    await user.click(screen.getByRole("button", { name: "Nuevo recurso" }));

    const audienceSelect = screen.getByLabelText("Audiencia") as HTMLSelectElement;
    const familiesOption = Array.from(audienceSelect.options).find((o) => o.value === "families");
    expect(familiesOption?.disabled).toBe(false);

    await user.type(screen.getByLabelText("Título"), "Guía familias");
    await user.selectOptions(audienceSelect, "families");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Guía familias", audience: "families" }),
      expect.anything(),
    );
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

  it("editar A y después B precarga los valores de B, no los de A", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({
      data: [
        buildEntityResource({ id: 1, title: "Guía de acogida", kind: "text", body: "Bienvenida" }),
        buildEntityResource({ id: 2, title: "Curso de formación", kind: "text", body: "Temario" }),
      ],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    expect(screen.getByLabelText("Título")).toHaveValue("Guía de acogida");

    await user.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    expect(screen.getByLabelText("Título")).toHaveValue("Curso de formación");
    expect(screen.getByLabelText("Texto")).toHaveValue("Temario");
  });

  it("con «Nuevo recurso» abierto, editar un recurso precarga sus valores", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({
      data: [buildEntityResource({ id: 1, title: "Guía de acogida", kind: "text", body: "Bienvenida" })],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Nuevo recurso" }));
    await user.type(screen.getByLabelText("Título"), "Borrador a medias");

    await user.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByLabelText("Título")).toHaveValue("Guía de acogida");
  });

  it("eliminar pide confirmación antes de llamar a la mutación", async () => {
    const mutate = vi.fn();
    mockDefaults();
    useDeleteResourceMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null, reset: vi.fn() });
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

  it("el error de borrado se pinta dentro del diálogo, que sigue abierto", async () => {
    mockDefaults();
    useDeleteResourceMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      // `kind` es lo que ahora decide el texto (`errorKindText`); el
      // mensaje real del hook para `sin_permiso` es «…eliminar recursos.»
      // (`hooks/useDeleteResource.ts`) — antes este mock usaba «borrar»,
      // una palabra que el hook nunca emite, porque el componente se
      // limitaba a pintar `.message` tal cual.
      error: { message: "Solo titular o moderador pueden eliminar recursos.", kind: "sin_permiso" },
      reset: vi.fn(),
    });
    useResourcesMock.mockReturnValue({
      data: [buildEntityResource({ id: 1, title: "Guía de acogida" })],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialog = screen.getByRole("alertdialog");

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Solo titular o moderador pueden eliminar recursos.",
    );
  });

  it("al abrir el diálogo de borrado se limpia el error del intento anterior", async () => {
    const reset = vi.fn();
    mockDefaults();
    useDeleteResourceMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset,
    });
    useResourcesMock.mockReturnValue({
      data: [buildEntityResource({ id: 1, title: "Guía de acogida" })],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(reset).toHaveBeenCalled();
  });

  it("tipo «Enlace» sin URL no deja guardar", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Nuevo recurso" }));
    await user.type(screen.getByLabelText("Título"), "Web de la entidad");
    await user.selectOptions(screen.getByLabelText("Tipo"), "link");

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    await user.type(screen.getByLabelText("Enlace"), "https://popyplan.com");

    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });

  it("creando un recurso de tipo PDF sin fichero no deja guardar", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Nuevo recurso" }));
    await user.type(screen.getByLabelText("Título"), "Memoria 2026");
    await user.selectOptions(screen.getByLabelText("Tipo"), "pdf");

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("editando un recurso que ya tiene fichero, el fichero es opcional", async () => {
    mockDefaults();
    useResourcesMock.mockReturnValue({
      data: [
        buildEntityResource({
          id: 1,
          title: "Memoria 2026",
          kind: "pdf",
          body: "",
          file: "https://cdn.example/memoria.pdf",
        }),
      ],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });

  it("editar un recurso de texto y pasarlo a enlace manda body vacío para limpiar el anterior", async () => {
    const mutate = vi.fn();
    mockDefaults();
    useUpdateResourceMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });
    useResourcesMock.mockReturnValue({
      data: [buildEntityResource({ id: 1, title: "Guía de acogida", kind: "text", body: "Bienvenida" })],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.selectOptions(screen.getByLabelText("Tipo"), "link");
    await user.type(screen.getByLabelText("Enlace"), "https://popyplan.com");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 1, kind: "link", url: "https://popyplan.com", body: "" }),
      expect.anything(),
    );
  });

  it("editar solo el título de un PDF no toca body ni url", async () => {
    const mutate = vi.fn();
    mockDefaults();
    useUpdateResourceMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });
    useResourcesMock.mockReturnValue({
      data: [
        buildEntityResource({
          id: 1,
          title: "Memoria 2026",
          kind: "pdf",
          body: "Resumen de la memoria",
          file: "https://cdn.example/memoria.pdf",
        }),
      ],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.type(screen.getByLabelText("Título"), " (v2)");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const [payload] = mutate.mock.calls[0];
    expect(payload.title).toBe("Memoria 2026 (v2)");
    expect(payload.body).toBeUndefined();
    expect(payload.url).toBeUndefined();
  });

  it("editar un enlace y pasarlo a texto manda url vacía para limpiar la anterior", async () => {
    const mutate = vi.fn();
    mockDefaults();
    useUpdateResourceMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });
    useResourcesMock.mockReturnValue({
      data: [
        buildEntityResource({
          id: 1,
          title: "Web de la entidad",
          kind: "link",
          body: "",
          url: "https://popyplan.com",
        }),
      ],
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.selectOptions(screen.getByLabelText("Tipo"), "text");
    await user.type(screen.getByLabelText("Texto"), "Ahora es texto");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 1, kind: "text", body: "Ahora es texto", url: "" }),
      expect.anything(),
    );
  });

  it("con el guardado en vuelo, «Cancelar» está deshabilitado", async () => {
    mockDefaults();
    useCreateResourceMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    });
    useResourcesMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Nuevo recurso" }));

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
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
