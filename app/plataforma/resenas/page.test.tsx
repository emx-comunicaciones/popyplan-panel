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
import { buildPlatformReview } from "@/test-utils/fixtures/platformCommunity";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaResenasPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const REVIEWS = [
  buildPlatformReview(),
  buildPlatformReview({
    id: "r2",
    reviewer: { id: 9, public_name: "Ane", first_name: "Ane", last_name: "", photo: null, verification_level: 1 },
    rating: 2,
    comment: "",
    review_type: "team",
  }),
];

function page(results: unknown[], extra: Record<string, unknown> = {}) {
  return { count: results.length, next: null, previous: null, results, ...extra };
}

function mockBackend(onDelete?: () => unknown, list: (path: string) => unknown = () => page(REVIEWS)) {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (init?.method === "DELETE") return onDelete ? onDelete() : { message: "Reseña eliminada" };
    if (path.startsWith("/api/reviews/?")) return list(path);
    throw new Error(`sin mock para ${path}`);
  });
}

function superadmin(role = "superadmin") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole(role),
  });
}

async function renderPage() {
  return render(await PlataformaResenasPage());
}

describe("PlataformaResenasPage", () => {
  it("no tiene violaciones de accesibilidad (axe), con la tabla y el diálogo de borrar abierto", async () => {
    mockBackend();
    superadmin();
    const { container } = await renderPage();
    await screen.findByText("Muy buena actividad, repetiré.");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Reseñas");
  });

  it("sin sesión redirige al login; sin rol de plataforma, a la raíz", async () => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaResenasPage()).rejects.toBeInstanceOf(NextRedirectSignal);
    getServerSessionMock.mockResolvedValue({ token: "t", me: buildMe(), platformRole: { role: null } });
    await expect(PlataformaResenasPage()).rejects.toBeInstanceOf(NextRedirectSignal);
  });

  it("un verifier ve «Sin acceso»", async () => {
    superadmin("verifier");
    await renderPage();
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("pinta autor, valoración, comentario y tipo", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    const rows = await screen.findAllByRole("row");
    expect(within(rows[1]).getByText("Diego")).toBeInTheDocument();
    expect(within(rows[1]).getByText("5 de 5")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Actividad")).toBeInTheDocument();
    expect(within(rows[2]).getByText("2 de 5")).toBeInTheDocument();
    expect(within(rows[2]).getByText("—")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Equipo")).toBeInTheDocument();
    expect(screen.getByText("2 reseñas")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/reviews/?page=1");
  });

  it("borrar con confirmación; un 403 con `error` se lee dentro del diálogo", async () => {
    let fail = true;
    mockBackend(() => {
      if (fail) throw new ApiError(403, { error: "Solo el autor o un moderador pueden eliminar la reseña" });
      return { message: "Reseña eliminada" };
    });
    superadmin();
    await renderPage();
    await userEvent.click((await screen.findAllByRole("button", { name: "Borrar" }))[0]);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Se borra la reseña de Diego. No se puede deshacer.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
    expect(
      await within(dialog).findByText("Solo el autor o un moderador pueden eliminar la reseña"),
    ).toBeInTheDocument();
    fail = false;
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/reviews/7ef76c9d-58df-425e-8b99-ea5ffbb3db0e/", {
      method: "DELETE",
    });

    await userEvent.click(screen.getAllByRole("button", { name: "Borrar" })[1]);
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("pagina y vuelve a la primera si la página deja de existir", async () => {
    mockBackend(undefined, (path) => {
      if (path.includes("page=3")) throw new ApiError(404, null);
      if (path.includes("page=2")) return page([REVIEWS[1]], { count: 41, previous: "p1", next: "p3" });
      return page([REVIEWS[0]], { count: 41, next: "p2" });
    });
    superadmin();
    await renderPage();
    await screen.findByText("Diego");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Ane");
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByText("Diego");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Ane");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/reviews/?page=3"));
    await screen.findByText("Diego");
  });

  it("vacío y error", async () => {
    mockBackend(undefined, () => page([]));
    superadmin();
    const { unmount } = await renderPage();
    expect(await screen.findByText("Todavía no hay reseñas")).toBeInTheDocument();
    unmount();

    mockBackend(undefined, () => {
      throw new ApiError(500, null);
    });
    await renderPage();
    expect(await screen.findByText("No se pudieron cargar las reseñas")).toBeInTheDocument();
  });
});
