import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { ApiError } from "@/lib/api/client";
import { render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaNomencladoresPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

/** Respuestas reales por ruta, con las tres formas de listado del backend. */
const LISTS: Record<string, unknown> = {
  "/api/catalogs/languages/": [
    { id: 1, code: "es", label: "Español", order: 1, is_active: true },
    { id: 9, code: "gl", label: "Gallego", order: 9, is_active: false },
  ],
  "/api/catalogs/hobby-categories/": [{ id: 1, code: "creative", label: "Creativos", order: 1, is_active: true, emoji: "🎨", hobbies: [] }],
  "/api/catalogs/hobbies/": [{ id: 2, code: "pintura", label: "Pintura", order: 1, is_active: true, category: 1, category_code: "creative" }],
  "/api/community-categories/?page=1": {
    count: 1,
    next: null,
    previous: null,
    results: [{ id: "c1", name: "Bienestar", emoji: "🌿", image: null, is_active: true, communities_count: 3, subcategories: [] }],
  },
  "/api/community-subcategories/": [{ id: "s1", name: "Meditación", category: "c1", is_active: true }],
  "/api/event-categories/": {
    results: [{ id: 2, name: "Culturales", category_type: "cultural", description: "", icon: "🎭", is_active: true, subcategories: [] }],
    count: 1,
  },
  "/api/event-subcategories/": {
    results: [{ id: "e1", name: "Cine", category_id: "2", is_active: true, created_at: "2026-09-04T00:00:00Z" }],
    count: 1,
  },
};

interface BackendOptions {
  write?: (path: string, method: string, body: unknown) => unknown;
  list?: (path: string) => unknown;
}

function mockBackend(options: BackendOptions = {}) {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method) return options.write ? options.write(path, init.method, init.body) : {};
    if (options.list) return options.list(path);
    if (path in LISTS) return LISTS[path];
    throw new Error(`sin mock para ${path}`);
  });
}

function superadmin() {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole("superadmin"),
  });
}

async function renderPage() {
  return render(await PlataformaNomencladoresPage());
}

describe("PlataformaNomencladoresPage", () => {
  it("no tiene violaciones de accesibilidad (axe), con la tabla y el diálogo de alta abiertos", async () => {
    mockBackend();
    superadmin();
    const { container } = await renderPage();
    await screen.findByText("Español");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: "Nuevo elemento" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Nomencladores");
  });

  it("idiomas por defecto: filas activas e inactivas, alta y edición", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    const inactive = (await screen.findByText("Gallego")).closest("tr") as HTMLElement;
    expect(within(inactive).getByText("Inactivo")).toBeInTheDocument();
    expect(screen.getByText("2 elementos")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Nuevo elemento" }));
    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Código"), "eu");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Euskera");
    await userEvent.clear(within(dialog).getByLabelText("Orden"));
    await userEvent.type(within(dialog).getByLabelText("Orden"), "8");
    await userEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/catalogs/languages/", {
      method: "POST",
      body: { code: "eu", label: "Euskera", order: 8, is_active: true },
    });

    await userEvent.click(within(inactive).getByRole("button", { name: "Editar" }));
    const edit = screen.getByRole("dialog");
    expect(within(edit).getByLabelText("Nombre")).toHaveValue("Gallego");
    await userEvent.click(within(edit).getByLabelText("Activo"));
    await userEvent.click(within(edit).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/catalogs/languages/9/", {
      method: "PATCH",
      body: { code: "gl", label: "Gallego", order: 9, is_active: true },
    });
  });

  it("aficiones: la categoría sale de su catálogo y es obligatoria", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await userEvent.selectOptions(screen.getByLabelText("Nomenclador"), "hobbies");
    const row = (await screen.findByText("Pintura")).closest("tr") as HTMLElement;
    expect(await within(row).findByText("Creativos")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Nuevo elemento" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Código"), "yoga");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Yoga");
    const save = within(dialog).getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    await userEvent.selectOptions(within(dialog).getByLabelText("Categoría"), "1");
    await userEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/catalogs/hobbies/", {
      method: "POST",
      body: { code: "yoga", label: "Yoga", order: 0, is_active: true, category: 1 },
    });
  });

  it("categorías de comunidad: comunidades, emoji y aviso de borrado en cascada", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await userEvent.selectOptions(screen.getByLabelText("Nomenclador"), "communityCategories");
    const row = (await screen.findByText("Bienestar")).closest("tr") as HTMLElement;
    expect(within(row).getByText("🌿")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/La imagen de la categoría no se sube desde el panel/)).toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: "Borrar" }));
    const confirm = screen.getByRole("alertdialog");
    expect(confirm).toHaveTextContent("¿Borrar «Bienestar»?");
    expect(confirm).toHaveTextContent("Se borran también todas sus subcategorías");
    await userEvent.click(within(confirm).getByRole("button", { name: "Borrar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/community-categories/c1/", { method: "DELETE" });
  });

  it("subcategorías de comunidad y de actividad: pintan su categoría", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await userEvent.selectOptions(screen.getByLabelText("Nomenclador"), "communitySubcategories");
    const sub = (await screen.findByText("Meditación")).closest("tr") as HTMLElement;
    expect(await within(sub).findByText("Bienestar")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Nomenclador"), "eventSubcategories");
    const eventSub = (await screen.findByText("Cine")).closest("tr") as HTMLElement;
    expect(await within(eventSub).findByText("Culturales")).toBeInTheDocument();
    await userEvent.click(within(eventSub).getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Categoría")).toHaveValue("2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/event-subcategories/e1/", {
      method: "PATCH",
      body: { name: "Cine", category: 2, is_active: true },
    });
  });

  it("categorías de actividad: tipo, icono y descripción", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await userEvent.selectOptions(screen.getByLabelText("Nomenclador"), "eventCategories");
    const row = (await screen.findByText("Culturales")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Cultura")).toBeInTheDocument();
    expect(within(row).getByText("🎭")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Nuevo elemento" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Montaña");
    await userEvent.selectOptions(within(dialog).getByLabelText("Tipo"), "sports");
    await userEvent.type(within(dialog).getByLabelText("Icono"), "⛰");
    await userEvent.type(within(dialog).getByLabelText("Descripción"), "Rutas");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/event-categories/", {
      method: "POST",
      body: { name: "Montaña", category_type: "sports", icon: "⛰", description: "Rutas", is_active: true },
    });
  });

  it("categorías de afición: un error del servidor al borrar se queda dentro y explica la causa probable", async () => {
    mockBackend({
      write: () => {
        throw new ApiError(500, null);
      },
    });
    superadmin();
    await renderPage();
    await userEvent.selectOptions(screen.getByLabelText("Nomenclador"), "hobbyCategories");
    const row = (await screen.findByText("Creativos")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Borrar" }));
    const confirm = screen.getByRole("alertdialog");
    expect(confirm).toHaveTextContent("Una categoría con aficiones no se puede borrar");
    await userEvent.click(within(confirm).getByRole("button", { name: "Borrar" }));
    expect(await within(confirm).findByRole("alert")).toHaveTextContent("puede que el elemento esté en uso");
    await userEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("un 400 al guardar pinta el detalle del backend dentro del diálogo; Cancelar cierra", async () => {
    mockBackend({
      write: () => {
        throw new ApiError(400, { code: ["Ya existe un idioma con este código."] });
      },
    });
    superadmin();
    await renderPage();
    await screen.findByText("Español");
    await userEvent.click(screen.getByRole("button", { name: "Nuevo elemento" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Código"), "es");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Español");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ya existe un idioma con este código.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("vacío y error de carga", async () => {
    mockBackend({ list: () => [] });
    superadmin();
    const { unmount } = await renderPage();
    expect(await screen.findByText("Este nomenclador está vacío")).toBeInTheDocument();
    unmount();

    mockBackend({
      list: () => {
        throw new ApiError(403, null);
      },
    });
    await renderPage();
    expect(await screen.findByText("No se pudo cargar el nomenclador")).toBeInTheDocument();
    expect(screen.getByText("Solo el personal de plataforma edita los nomencladores.")).toBeInTheDocument();
  });

  it("moderator ve «Sin acceso»; sin sesión va a /login; sin rol de plataforma a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });
    render(await PlataformaNomencladoresPage());
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();

    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaNomencladoresPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });
    await expect(PlataformaNomencladoresPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
