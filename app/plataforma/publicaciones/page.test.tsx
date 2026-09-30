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
import {
  buildPlatformActivityPost,
  buildPlatformCommunityPost,
  buildPlatformOpenPost,
} from "@/test-utils/fixtures/platformCommunity";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaPublicacionesPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const POSTS = [
  buildPlatformOpenPost(),
  buildPlatformActivityPost(),
  buildPlatformCommunityPost({
    id: "com-1",
    audience: "community",
    where: { type: "community", id: "c1", name: "Senderistas de Bilbao" },
    author_name: "Mikel",
  }),
  buildPlatformCommunityPost({ id: "old-1", author_name: "Ane", is_active: false }),
];

function page(results: unknown[], extra: Record<string, unknown> = {}) {
  return { count: results.length, next: null, previous: null, results, ...extra };
}

function mockBackend(
  list: (path: string) => unknown = () => page(POSTS),
  onMutate?: (path: string, init: { method?: string; body?: unknown }) => unknown,
) {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method) return onMutate ? onMutate(path, init) : undefined;
    if (path.startsWith("/api/community-posts/?")) return list(path);
    throw new Error(`sin mock para ${path}`);
  });
}

function session(role = "superadmin") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole(role),
  });
}

async function renderPage() {
  return render(await PlataformaPublicacionesPage());
}

describe("PlataformaPublicacionesPage", () => {
  it("no tiene violaciones de accesibilidad (axe), con la tabla y el diálogo de borrar abierto", async () => {
    mockBackend();
    session();
    const { container } = await renderPage();
    await screen.findByText("¿Alguien se apunta a caminar el sábado?");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Publicaciones");
  });

  it("sin sesión redirige al login; sin rol de plataforma, a la raíz", async () => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaPublicacionesPage()).rejects.toBeInstanceOf(NextRedirectSignal);
    getServerSessionMock.mockResolvedValue({ token: "t", me: buildMe(), platformRole: { role: null } });
    await expect(PlataformaPublicacionesPage()).rejects.toBeInstanceOf(NextRedirectSignal);
  });

  it.each(["verifier", "moderator", "support"])("%s ve «Sin acceso» y no pide nada", async (role) => {
    session(role);
    await renderPage();
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("lista todo junto y dice de dónde viene cada una; lo abierto no nombra nada", async () => {
    mockBackend();
    session();
    await renderPage();
    const rows = await screen.findAllByRole("row");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/?page=1");
    expect(within(rows[1]).getByText("Nerea")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Abierto")).toBeInTheDocument();
    expect(rows[1].querySelectorAll("p.text-xs")).toHaveLength(1); // solo las estadísticas
    expect(within(rows[2]).getByText("Actividad")).toBeInTheDocument();
    expect(within(rows[2]).getByText(/Ruta por el Gorbea/)).toBeInTheDocument();
    expect(within(rows[3]).getByText("Comunidad")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Senderistas de Bilbao")).toBeInTheDocument();
    // Sin `audience` (backend antiguo) se lee como comunidad.
    expect(within(rows[4]).getByText("Comunidad")).toBeInTheDocument();
    expect(within(rows[4]).getByText("Oculta")).toBeInTheDocument();
    expect(screen.getByText("4 publicaciones")).toBeInTheDocument();
  });

  it("filtra por sitio y por estado y vuelve a la primera página", async () => {
    mockBackend();
    session();
    await renderPage();
    await screen.findByText("Nerea");
    await userEvent.selectOptions(screen.getByLabelText("Publicada en"), "open");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/?page=1&audience=open"));
    await userEvent.selectOptions(screen.getByLabelText("Mostrar"), "false");
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/?page=1&audience=open&is_active=false"),
    );
    await userEvent.selectOptions(screen.getByLabelText("Publicada en"), "activity");
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/?page=1&audience=activity&is_active=false"),
    );
    await userEvent.selectOptions(screen.getByLabelText("Publicada en"), "");
    await waitFor(() => expect(apiFetchMock).toHaveBeenLastCalledWith("/api/community-posts/?page=1&is_active=false"));
  });

  it("oculta y muestra con PATCH, sin confirmación", async () => {
    mockBackend(undefined, () => buildPlatformOpenPost({ is_active: false }));
    session();
    await renderPage();
    await userEvent.click((await screen.findAllByRole("button", { name: "Ocultar" }))[0]);
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/open-1/", {
        method: "PATCH",
        body: { is_active: false },
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Mostrar" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/old-1/", {
        method: "PATCH",
        body: { is_active: true },
      }),
    );
  });

  it("borra con confirmación y un fallo se lee dentro del diálogo", async () => {
    let fail = true;
    mockBackend(undefined, () => {
      if (fail) throw new ApiError(500, null);
      return undefined;
    });
    session();
    await renderPage();
    await userEvent.click((await screen.findAllByRole("button", { name: "Borrar" }))[0]);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/Nerea/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
    await within(dialog).findByRole("alert");
    fail = false;
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/open-1/", { method: "DELETE" });
  });

  it("pagina y vuelve a la primera si la página deja de existir", async () => {
    mockBackend((path) => {
      if (path.includes("page=3")) throw new ApiError(404, null);
      if (path.includes("page=2")) return page([POSTS[1]], { count: 41, previous: "p1", next: "p3" });
      return page([POSTS[0]], { count: 41, next: "p2" });
    });
    session();
    await renderPage();
    await screen.findByText("Nerea");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Unai");
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByText("Nerea");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Unai");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/?page=3"));
    await screen.findByText("Nerea");
  });

  it("vacío y error", async () => {
    mockBackend(() => page([]));
    session();
    const { unmount } = await renderPage();
    expect(await screen.findByText("No hay publicaciones con este filtro")).toBeInTheDocument();
    unmount();

    mockBackend(() => {
      throw new ApiError(500, null);
    });
    await renderPage();
    expect(await screen.findByText("No se pudieron cargar las publicaciones")).toBeInTheDocument();
  });
});
