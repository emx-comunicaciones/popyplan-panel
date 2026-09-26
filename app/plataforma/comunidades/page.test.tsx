import { act, fireEvent } from "@testing-library/react";
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
import { render, screen, waitFor } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildEntityCommunityRow } from "@/test-utils/fixtures/community";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaComunidadesPage, { generateMetadata } from "./page";

afterEach(() => {
  vi.useRealTimers();
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const ROWS = [
  buildEntityCommunityRow({ id: "11111111-1111-4111-8111-111111111111", name: "Paseos al atardecer" }),
  buildEntityCommunityRow({
    id: "22222222-2222-4222-8222-222222222222",
    name: "Familias Bidasoa",
    space: "families",
    visibility: "private",
    owner: { type: "profile", id: "u1", name: "Marta", verified: false },
  }),
];

function page(results: unknown[], extra: Record<string, unknown> = {}) {
  return { count: results.length, next: null, previous: null, results, ...extra };
}

function superadmin(role = "superadmin") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole(role),
  });
}

async function renderPage() {
  return render(await PlataformaComunidadesPage());
}

describe("PlataformaComunidadesPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    apiFetchMock.mockResolvedValue(page(ROWS));
    superadmin();
    const { container } = await renderPage();
    await screen.findByText("Paseos al atardecer");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Comunidades");
  });

  it("sin sesión redirige al login", async () => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaComunidadesPage()).rejects.toBeInstanceOf(NextRedirectSignal);
  });

  it("sin rol de plataforma redirige a la raíz", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe(),
      platformRole: { role: null },
    });
    await expect(PlataformaComunidadesPage()).rejects.toBeInstanceOf(NextRedirectSignal);
  });

  it("un moderator ve «Sin acceso» y no pide nada", async () => {
    superadmin("moderator");
    await renderPage();
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("pinta propietaria, visibilidad, espacio y enlace a la ficha", async () => {
    apiFetchMock.mockResolvedValue(page(ROWS));
    superadmin();
    await renderPage();
    expect(await screen.findByRole("link", { name: "Familias Bidasoa" })).toHaveAttribute(
      "href",
      "/plataforma/comunidades/22222222-2222-4222-8222-222222222222",
    );
    expect(screen.getByText("Asociación Vecinal Alfaville")).toBeInTheDocument();
    expect(screen.getByText("Entidad")).toBeInTheDocument();
    expect(screen.getByText("Persona")).toBeInTheDocument();
    expect(screen.getByText("Privada")).toBeInTheDocument();
    expect(screen.getByText("Familias")).toBeInTheDocument();
    expect(screen.getByText("2 comunidades")).toBeInTheDocument();
    expect(screen.getByText(/El estado activa\/desactivada se ve en la ficha/)).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/?page=1");
  });

  it("busca con retardo y vuelve a la primera página", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiFetchMock.mockResolvedValue(page(ROWS));
    superadmin();
    await renderPage();
    await screen.findByText("Paseos al atardecer");
    fireEvent.change(screen.getByLabelText("Buscar (nombre o descripción)"), { target: { value: "bidasoa" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/?page=1&search=bidasoa"));
  });

  it("pagina con Siguiente/Anterior", async () => {
    apiFetchMock.mockImplementation(async (path: string) =>
      path.includes("page=2")
        ? page([ROWS[1]], { count: 21, previous: "p1" })
        : page([ROWS[0]], { count: 21, next: "p2" }),
    );
    superadmin();
    await renderPage();
    await screen.findByText("Paseos al atardecer");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Familias Bidasoa");
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByText("Paseos al atardecer");
  });

  it("vuelve a la primera página si la actual deja de existir", async () => {
    let calls = 0;
    apiFetchMock.mockImplementation(async (path: string) => {
      calls += 1;
      if (path.includes("page=2")) throw new ApiError(404, null);
      return calls === 1 ? page([ROWS[0]], { count: 21, next: "p2" }) : page([ROWS[0]]);
    });
    superadmin();
    await renderPage();
    await screen.findByText("Paseos al atardecer");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/?page=2"));
    await screen.findByText("Paseos al atardecer");
  });

  it("vacío y error", async () => {
    apiFetchMock.mockResolvedValueOnce(page([]));
    superadmin();
    const { unmount } = await renderPage();
    expect(await screen.findByText("No hay comunidades con esta búsqueda")).toBeInTheDocument();
    unmount();

    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    await renderPage();
    expect(await screen.findByText("No se pudieron cargar las comunidades")).toBeInTheDocument();
    expect(screen.getByText("Solo el personal de plataforma puede hacer esto.")).toBeInTheDocument();
  });
});
