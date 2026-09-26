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
import { NextNotFoundSignal, NextRedirectSignal, routerMock } from "@/test-utils/nextNavigationMock";
import { buildCommunityMember } from "@/test-utils/fixtures/community";
import { buildMe } from "@/test-utils/fixtures/me";
import {
  COMMUNITY_ID,
  buildPlatformCommunityDetail,
  buildPlatformCommunityPost,
} from "@/test-utils/fixtures/platformCommunity";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaComunidadDetailPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const POSTS = [
  buildPlatformCommunityPost(),
  buildPlatformCommunityPost({
    id: "p-video",
    author_name: "Ane",
    content: "",
    video_url: "http://localhost:8001/media/v.mov",
    is_active: false,
  }),
  buildPlatformCommunityPost({ id: "p-image", author_name: "Jon", content: "", images: [{ id: "i1" }] }),
  buildPlatformCommunityPost({ id: "p-empty", author_name: "Iker", content: "  " }),
  buildPlatformCommunityPost({ id: "p-long", author_name: "Leire", content: "x".repeat(200) }),
];

interface BackendOptions {
  detail?: () => unknown;
  onPatch?: (body: unknown) => unknown;
  onDelete?: () => unknown;
  posts?: (path: string) => unknown;
  onPostPatch?: () => unknown;
  onPostDelete?: () => unknown;
}

function page(results: unknown[], extra: Record<string, unknown> = {}) {
  return { count: results.length, next: null, previous: null, results, ...extra };
}

function mockBackend(options: BackendOptions = {}) {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? "GET";
    if (path === `/api/communities/${COMMUNITY_ID}/`) {
      if (method === "PATCH") return options.onPatch ? options.onPatch(init?.body) : buildPlatformCommunityDetail();
      if (method === "DELETE") return options.onDelete ? options.onDelete() : undefined;
      return options.detail ? options.detail() : buildPlatformCommunityDetail();
    }
    if (path.endsWith("/members/")) return [buildCommunityMember()];
    if (path.endsWith("/pending-requests/")) return [];
    if (path.startsWith("/api/community-posts/?")) return options.posts ? options.posts(path) : page(POSTS);
    if (path.startsWith("/api/community-posts/") && method === "PATCH") {
      return options.onPostPatch ? options.onPostPatch() : POSTS[0];
    }
    if (path.startsWith("/api/community-posts/") && method === "DELETE") {
      return options.onPostDelete ? options.onPostDelete() : undefined;
    }
    throw new Error(`sin mock para ${method} ${path}`);
  });
}

function superadmin(role = "superadmin") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole(role),
  });
}

async function renderPage(id = COMMUNITY_ID) {
  return render(await PlataformaComunidadDetailPage({ params: Promise.resolve({ id }) }));
}

describe("PlataformaComunidadDetailPage", () => {
  it("no tiene violaciones de accesibilidad (axe), con la ficha y el diálogo de borrar abierto", async () => {
    mockBackend();
    superadmin();
    const { container } = await renderPage();
    await screen.findByText("Durangaldeko Elkartea: talde itxia");
    await screen.findByText("Marta López");
    await screen.findByText("Mañana quedamos a las diez en la plaza.");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: "Borrar comunidad" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Ficha de la comunidad");
  });

  it("un id que no es un UUID da 404 sin leer la sesión", async () => {
    await expect(PlataformaComunidadDetailPage({ params: Promise.resolve({ id: "abc" }) })).rejects.toBeInstanceOf(
      NextNotFoundSignal,
    );
    expect(getServerSessionMock).not.toHaveBeenCalled();
  });

  it("sin sesión redirige al login; sin rol de plataforma, a la raíz", async () => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(renderPage()).rejects.toBeInstanceOf(NextRedirectSignal);
    getServerSessionMock.mockResolvedValue({ token: "t", me: buildMe(), platformRole: { role: null } });
    await expect(renderPage()).rejects.toBeInstanceOf(NextRedirectSignal);
  });

  it("un support ve «Sin acceso»", async () => {
    superadmin("support");
    await renderPage();
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("pinta los datos, el estado y el enlace a sus actividades", async () => {
    mockBackend({ detail: () => buildPlatformCommunityDetail({ category: { id: "c", name: "Deporte" }, place: null }) });
    superadmin();
    await renderPage();
    await screen.findByText("Durangaldeko Elkartea: talde itxia");
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText("Privada")).toBeInTheDocument();
    expect(screen.getByText("Deporte")).toBeInTheDocument();
    expect(screen.getByText("Taldea")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver sus actividades" })).toHaveAttribute(
      "href",
      `/plataforma/actividades?community=${COMMUNITY_ID}`,
    );
  });

  it("desactiva con confirmación y enseña el error dentro del diálogo", async () => {
    let fail = true;
    const onPatch = vi.fn<(body: unknown) => unknown>(() => {
      if (fail) throw new ApiError(400, { is_active: ["No válido."] });
      return buildPlatformCommunityDetail({ is_active: false });
    });
    mockBackend({ onPatch });
    superadmin();
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Desactivar" }));
    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Desactivar" }));
    expect(await within(dialog).findByText("No válido.")).toBeInTheDocument();
    expect(onPatch).toHaveBeenCalledWith({ is_active: false });

    fail = false;
    await userEvent.click(within(dialog).getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("una comunidad desactivada ofrece Reactivar", async () => {
    const onPatch = vi.fn(() => buildPlatformCommunityDetail());
    mockBackend({ detail: () => buildPlatformCommunityDetail({ is_active: false }), onPatch });
    superadmin();
    await renderPage();
    expect(await screen.findByText("Desactivada")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    expect(screen.getByText("¿Reactivar esta comunidad?")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("borrar vuelve al listado; un fallo se queda en el diálogo", async () => {
    let fail = true;
    mockBackend({
      onDelete: () => {
        if (fail) throw new ApiError(500, null);
        return undefined;
      },
    });
    superadmin();
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Borrar comunidad" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/Se borra «Durangaldeko Elkartea: talde itxia»/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar comunidad" }));
    expect(await within(dialog).findByText("No se pudo completar la acción.")).toBeInTheDocument();
    fail = false;
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar comunidad" }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/plataforma/comunidades"));
  });

  it("una comunidad que no existe dice «no existe»; otro error, «no se pudo cargar»", async () => {
    mockBackend({
      detail: () => {
        throw new ApiError(404, null);
      },
    });
    superadmin();
    const { unmount } = await renderPage();
    expect(await screen.findByText("Esta comunidad no existe o ya se borró")).toBeInTheDocument();
    unmount();

    mockBackend({
      detail: () => {
        throw new ApiError(500, null);
      },
    });
    await renderPage();
    expect(await screen.findByText("No se pudo cargar la comunidad")).toBeInTheDocument();
  });

  it("publicaciones: resumen del contenido, estado, ocultar y filtro", async () => {
    const onPostPatch = vi.fn(() => POSTS[0]);
    mockBackend({ onPostPatch });
    superadmin();
    await renderPage();
    const rows = await screen.findAllByRole("row");
    expect(screen.getByText("[Solo vídeo]")).toBeInTheDocument();
    expect(screen.getByText("[Solo imagen]")).toBeInTheDocument();
    expect(screen.getByText("[Sin texto]")).toBeInTheDocument();
    expect(screen.getByText(`${"x".repeat(140)}…`)).toBeInTheDocument();
    expect(screen.getAllByText("3 me gusta · 1 comentarios").length).toBeGreaterThan(0);
    expect(screen.getByText("Oculta")).toBeInTheDocument();
    expect(rows.length).toBeGreaterThan(1);

    const postTable = screen.getByRole("table", { name: "Publicaciones de la comunidad" });
    await userEvent.click(within(postTable).getAllByRole("button", { name: "Ocultar" })[0]);
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(`/api/community-posts/${POSTS[0].id}/`, {
        method: "PATCH",
        body: { is_active: false },
      }),
    );
    await userEvent.click(within(postTable).getByRole("button", { name: "Mostrar" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/p-video/", {
        method: "PATCH",
        body: { is_active: true },
      }),
    );

    await userEvent.selectOptions(screen.getByLabelText("Mostrar"), "false");
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        `/api/community-posts/?community=${COMMUNITY_ID}&page=1&is_active=false`,
      ),
    );
  });

  it("ocultar con error lo avisa en la fila", async () => {
    mockBackend({
      onPostPatch: () => {
        throw new ApiError(404, null);
      },
    });
    superadmin();
    await renderPage();
    const postTable = await screen.findByRole("table", { name: "Publicaciones de la comunidad" });
    await userEvent.click(within(postTable).getAllByRole("button", { name: "Ocultar" })[0]);
    expect(await screen.findByText("Esta comunidad o publicación ya no existe.")).toBeInTheDocument();
  });

  it("borrar una publicación pide confirmación y enseña el error dentro", async () => {
    let fail = true;
    mockBackend({
      onPostDelete: () => {
        if (fail) throw new ApiError(403, { detail: "No puedes." });
        return undefined;
      },
    });
    superadmin();
    await renderPage();
    const postTable = await screen.findByRole("table", { name: "Publicaciones de la comunidad" });
    await userEvent.click(within(postTable).getAllByRole("button", { name: "Borrar" })[0]);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/Se borra la publicación de Mikel/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
    expect(await within(dialog).findByText("No puedes.")).toBeInTheDocument();
    fail = false;
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await userEvent.click(within(postTable).getAllByRole("button", { name: "Borrar" })[1]);
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("publicaciones: vacío, error, paginación y vuelta a la primera página", async () => {
    mockBackend({ posts: () => page([]) });
    superadmin();
    const first = await renderPage();
    expect(await screen.findByText("No hay publicaciones con este filtro")).toBeInTheDocument();
    first.unmount();

    mockBackend({
      posts: () => {
        throw new ApiError(500, null);
      },
    });
    const second = await renderPage();
    expect(await screen.findByText("No se pudieron cargar las publicaciones")).toBeInTheDocument();
    second.unmount();

    mockBackend({
      posts: (path) => {
        if (path.includes("page=3")) throw new ApiError(404, null);
        if (path.includes("page=2")) return page([POSTS[1]], { count: 41, previous: "p1", next: "p3" });
        return page([POSTS[0]], { count: 41, next: "p2" });
      },
    });
    await renderPage();
    expect(await screen.findByText("41 publicaciones")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("[Solo vídeo]");
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByText("Mañana quedamos a las diez en la plaza.");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("[Solo vídeo]");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(`/api/community-posts/?community=${COMMUNITY_ID}&page=3`),
    );
    await screen.findByText("Mañana quedamos a las diez en la plaza.");
  });
});
