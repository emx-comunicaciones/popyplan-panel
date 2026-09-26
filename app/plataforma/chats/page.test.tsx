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
import type { PlatformChatRoom } from "@/lib/api/types";
import { act, fireEvent, render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaChatsPage, { generateMetadata } from "./page";

afterEach(() => {
  vi.useRealTimers();
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const person = (id: number, name: string) => ({
  id,
  public_name: name,
  first_name: name,
  last_name: "",
  photo: null,
  verification_level: 0,
});

const ROOMS: PlatformChatRoom[] = [
  {
    id: "fd549523-c4f6-4f29-a94f-c6c314c0426d",
    chat_type: "group",
    name: "Chat de General",
    participants: [person(7, "Titular"), person(214, "Mikel")],
    group_source: "community",
  },
  {
    id: "0b1f2e3d-0000-4000-8000-000000000002",
    chat_type: "individual",
    name: null,
    participants: [person(13, "Persona 01"), person(14, "Persona 02")],
    group_source: null,
  },
  {
    id: "0b1f2e3d-0000-4000-8000-000000000003",
    chat_type: "individual",
    name: "",
    participants: [],
    group_source: "origen_nuevo",
  },
];

function mockBackend(handler: (path: string) => unknown = () => ({ count: 3, next: null, previous: null, results: ROOMS })) {
  apiFetchMock.mockImplementation(async (path: string) => handler(path));
}

function superadmin() {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole("superadmin"),
  });
}

describe("PlataformaChatsPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockBackend();
    superadmin();
    const { container } = render(await PlataformaChatsPage());
    await screen.findByRole("link", { name: "Chat de General" });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Chats");
  });

  it("pinta las salas: nombre o alias de participantes, tipo, origen y recuento", async () => {
    mockBackend();
    superadmin();
    render(await PlataformaChatsPage());
    expect(await screen.findByRole("link", { name: "Chat de General" })).toHaveAttribute(
      "href",
      `/plataforma/chats/${ROOMS[0].id}`,
    );
    expect(screen.getByRole("link", { name: "Persona 01, Persona 02" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "—" })).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("De grupo")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Comunidad")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Entre dos personas")).toBeInTheDocument();
    // Un origen que el panel no conoce se pinta tal cual.
    expect(within(rows[3]).getByText("origen_nuevo")).toBeInTheDocument();
    expect(screen.getByText("3 chats")).toBeInTheDocument();
    expect(screen.getByText(/La búsqueda solo mira el nombre de la sala/)).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/chats/?page=1");
  });

  it("filtra por tipo y busca con retardo", async () => {
    mockBackend();
    superadmin();
    render(await PlataformaChatsPage());
    await screen.findByRole("link", { name: "Chat de General" });
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "individual");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/chats/?page=1&chat_type=individual"));

    vi.useFakeTimers();
    const input = screen.getByLabelText("Buscar por nombre de la sala");
    for (const value of ["g", "ge", "gen"]) fireEvent.change(input, { target: { value } });
    const searches = () =>
      apiFetchMock.mock.calls.map(([path]) => String(path)).filter((path) => path.includes("search="));
    expect(searches()).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(searches()).toEqual(["/api/admin/chats/?page=1&chat_type=individual&search=gen"]);
  });

  it("pagina, vuelve a la primera con un 404 y pinta vacío y error", async () => {
    mockBackend((path) => {
      if (path.includes("page=3")) throw new ApiError(404, null);
      if (path.includes("page=2")) return { count: 50, next: "p3", previous: "p1", results: [ROOMS[1]] };
      return { count: 50, next: "p2", previous: null, results: [ROOMS[0]] };
    });
    superadmin();
    const { unmount } = render(await PlataformaChatsPage());
    await screen.findByRole("link", { name: "Chat de General" });
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("link", { name: "Persona 01, Persona 02" });
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByRole("link", { name: "Chat de General" });
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("link", { name: "Persona 01, Persona 02" });
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("link", { name: "Chat de General" });
    unmount();

    mockBackend(() => ({ count: 0, next: null, previous: null, results: [] }));
    const second = render(await PlataformaChatsPage());
    expect(await screen.findByText("No hay chats con estos filtros")).toBeInTheDocument();
    second.unmount();

    mockBackend(() => {
      throw new ApiError(403, null);
    });
    render(await PlataformaChatsPage());
    expect(await screen.findByText("No se pudieron cargar los chats")).toBeInTheDocument();
    expect(screen.getByText("Solo el personal de plataforma ve los chats.")).toBeInTheDocument();
  });

  it("moderator ve «Sin acceso»; sin sesión va a /login; sin rol de plataforma a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });
    render(await PlataformaChatsPage());
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();

    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaChatsPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });
    await expect(PlataformaChatsPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
