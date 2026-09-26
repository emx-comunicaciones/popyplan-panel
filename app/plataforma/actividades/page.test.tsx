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
import type { PlatformEventRow } from "@/lib/api/types";
import { act, fireEvent, render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaActividadesPage, { generateMetadata } from "./page";

afterEach(() => {
  vi.useRealTimers();
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const COMMUNITY_ID = "d898e060-da9b-495f-9afd-7c40e2ebdd1e";

function buildEvent(overrides: Partial<PlatformEventRow> = {}): PlatformEventRow {
  return {
    id: "43fb05fa-bf10-45ed-a638-dfd7af5e1a75",
    title: "Yoga al amanecer en Ulia",
    starts_at: "2026-10-03T08:00:00+02:00",
    ends_at: "2026-10-03T10:00:00+02:00",
    audience: "anyone",
    status: "scheduled",
    place: { ine_code: "20069", name: "Donostia/San Sebastián", prov_name: "Gipuzkoa" },
    capacity: 20,
    seats_taken: 9,
    organizer: { id: 220, public_name: "Unai", first_name: "Unai", last_name: "", photo: null, verification_level: 1 },
    owner: { type: "profile", id: 220, name: "Unai", verified: false },
    community: { id: COMMUNITY_ID, name: "Montaña Gipuzkoa" },
    ...overrides,
  };
}

const EVENTS = [
  buildEvent(),
  buildEvent({
    id: "e2",
    title: "Charla de hábitos",
    status: "cancelled",
    audience: "organization",
    capacity: null,
    seats_taken: 3,
    owner: { type: "organization", id: 101, name: "Asociación Bidasoa", verified: true },
    community: null,
    place: null,
  }),
];

type Handler = (path: string, options?: { method?: string }) => unknown;

function mockBackend(overrides: Handler = () => undefined) {
  apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
    const custom = overrides(path, options);
    if (custom !== undefined) return custom;
    if (path.startsWith("/api/events/agenda/") || path.startsWith("/api/events/?")) {
      return { count: 2, next: null, previous: null, results: EVENTS };
    }
    if (path.startsWith("/api/communities/?search=")) {
      return { count: 1, next: null, previous: null, results: [{ id: COMMUNITY_ID, name: "Montaña Gipuzkoa" }] };
    }
    if (path === `/api/communities/${COMMUNITY_ID}/`) return { id: COMMUNITY_ID, name: "Montaña Gipuzkoa" };
    if (path.endsWith("/cancel/")) return { ...EVENTS[0], status: "cancelled" };
    if (path.startsWith("/api/events/")) {
      return {
        ...EVENTS[0],
        description: "Sesión de hatha suave.",
        address: "Monte Ulia",
        category: { id: 2, name: "Deporte" },
      };
    }
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

async function renderPage(query: Record<string, string> = {}) {
  return render(await PlataformaActividadesPage({ searchParams: Promise.resolve(query) }));
}

describe("PlataformaActividadesPage", () => {
  it("no tiene violaciones de accesibilidad (axe), con la tabla, el detalle y el diálogo de cancelar", async () => {
    mockBackend();
    superadmin();
    const { container } = await renderPage();
    await screen.findByText("Yoga al amanecer en Ulia");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getAllByRole("button", { name: "Ver" })[0]);
    await screen.findByText("Sesión de hatha suave.");
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await userEvent.click(screen.getByRole("button", { name: "Cancelar actividad" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Actividades");
  });

  it("por defecto pinta la agenda con su pista y las columnas", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    expect(screen.getByText(/Agenda: solo actividades programadas desde hoy/)).toBeInTheDocument();
    const rows = await screen.findAllByRole("row");
    expect(within(rows[1]).getByText("Programada")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Abierta")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Unai")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Montaña Gipuzkoa")).toBeInTheDocument();
    expect(within(rows[1]).getByText("9 de 20")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Cancelada")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Solo la entidad")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Asociación Bidasoa")).toBeInTheDocument();
    expect(within(rows[2]).getByText("3")).toBeInTheDocument();
    // Solo la programada se puede cancelar.
    expect(screen.getAllByRole("button", { name: "Cancelar actividad" })).toHaveLength(1);
    expect(screen.getByText("2 actividades")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/events/agenda/?page=1");
  });

  it("filtra la agenda por fechas", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await screen.findByText("Yoga al amanecer en Ulia");
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-31" } });
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/events/agenda/?page=1&from=2026-10-01&to=2026-10-31"),
    );
  });

  it("con ?community= lista las de la comunidad, con su nombre, y vuelve a la agenda", async () => {
    mockBackend();
    superadmin();
    await renderPage({ community: COMMUNITY_ID });
    expect(await screen.findByText(/Todas las actividades de «Montaña Gipuzkoa»/)).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/events/?page=1&community=${COMMUNITY_ID}`);
    expect(screen.queryByLabelText("Desde")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volver a la agenda" }));
    expect(screen.getByLabelText("Desde")).toBeInTheDocument();
  });

  it("sin nombre todavía dice «la comunidad elegida»; un ?community= que no es UUID se ignora", async () => {
    mockBackend((path) =>
      path === `/api/communities/${COMMUNITY_ID}/` ? new Promise(() => undefined) : undefined,
    );
    superadmin();
    const { unmount } = await renderPage({ community: COMMUNITY_ID });
    expect(screen.getByText(/Todas las actividades de la comunidad elegida/)).toBeInTheDocument();
    unmount();

    mockBackend();
    await renderPage({ community: "no-soy-uuid" });
    expect(screen.getByText(/Agenda: solo actividades/)).toBeInTheDocument();
  });

  it("el buscador de comunidades va con retardo y elegir una cambia de modo", async () => {
    mockBackend();
    superadmin();
    vi.useFakeTimers();
    await renderPage();
    const input = screen.getByLabelText("Buscar comunidad");
    for (const value of ["m", "mo", "mon"]) fireEvent.change(input, { target: { value } });
    const searches = () =>
      apiFetchMock.mock.calls.map(([path]) => String(path)).filter((path) => path.includes("search="));
    expect(searches()).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(searches()).toEqual(["/api/communities/?search=mon"]);
    vi.useRealTimers();

    await userEvent.click(await screen.findByRole("button", { name: "Montaña Gipuzkoa" }));
    expect(screen.getByText(/Todas las actividades de «Montaña Gipuzkoa»/)).toBeInTheDocument();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(`/api/events/?page=1&community=${COMMUNITY_ID}`),
    );
  });

  it("el buscador avisa si no hay coincidencias o si falla", async () => {
    mockBackend((path) =>
      path.includes("search=nada") ? { count: 0, next: null, previous: null, results: [] } : undefined,
    );
    superadmin();
    await renderPage();
    await userEvent.type(screen.getByLabelText("Buscar comunidad"), "nada");
    expect(await screen.findByText("Ninguna comunidad coincide.")).toBeInTheDocument();

    mockBackend((path) => {
      if (path.includes("search=")) throw new ApiError(500, null);
      return undefined;
    });
    await userEvent.type(screen.getByLabelText("Buscar comunidad"), "x");
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron buscar comunidades.");
  });

  it("«Ver» enseña el detalle; un fallo se dice dentro del diálogo", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await screen.findByText("Yoga al amanecer en Ulia");
    await userEvent.click(screen.getAllByRole("button", { name: "Ver" })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Monte Ulia")).toBeInTheDocument();
    expect(within(dialog).getByText("Deporte")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    mockBackend((path) => {
      if (path === "/api/events/e2/") throw new ApiError(404, null);
      return undefined;
    });
    await userEvent.click(screen.getAllByRole("button", { name: "Ver" })[1]);
    expect(await screen.findByRole("alert")).toHaveTextContent("No tienes acceso a esta actividad.");
  });

  it("cancelar manda la petición y cierra; un error se queda en el diálogo", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await screen.findByText("Yoga al amanecer en Ulia");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar actividad" }));
    let dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/se avisa a todas las personas inscritas/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar actividad" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/events/${EVENTS[0].id}/cancel/`, { method: "POST" });

    mockBackend((path) => {
      if (path.endsWith("/cancel/")) throw new ApiError(403, null);
      return undefined;
    });
    await userEvent.click(screen.getByRole("button", { name: "Cancelar actividad" }));
    dialog = screen.getByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar actividad" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No puedes cancelar esta actividad.");
    await userEvent.click(within(dialog).getByRole("button", { name: "No cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("pagina, vuelve a la primera con un 404 y pinta vacío y error", async () => {
    mockBackend((path) => {
      if (path.includes("page=3")) throw new ApiError(404, null);
      if (path.includes("page=2")) return { count: 45, next: "p3", previous: "p1", results: [EVENTS[1]] };
      if (path.includes("page=1")) return { count: 45, next: "p2", previous: null, results: [EVENTS[0]] };
      return undefined;
    });
    superadmin();
    await renderPage();
    await screen.findByText("Yoga al amanecer en Ulia");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Charla de hábitos");
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByText("Yoga al amanecer en Ulia");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Charla de hábitos");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Yoga al amanecer en Ulia");

    mockBackend((path) =>
      path.startsWith("/api/events/agenda/") ? { count: 0, next: null, previous: null, results: [] } : undefined,
    );
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2030-01-01" } });
    expect(await screen.findByText("No hay actividades con estos filtros")).toBeInTheDocument();

    mockBackend((path) => {
      if (path.startsWith("/api/events/agenda/")) throw new ApiError(400, { from: ["Fecha inválida."] });
      return undefined;
    });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2030-02-01" } });
    expect(await screen.findByText("No se pudieron cargar las actividades")).toBeInTheDocument();
    expect(screen.getByText("Fecha inválida.")).toBeInTheDocument();
  });

  it("moderator ve «Sin acceso»; sin sesión va a /login; sin rol de plataforma a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });
    render(await PlataformaActividadesPage({}));
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();

    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaActividadesPage({})).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });
    await expect(PlataformaActividadesPage({})).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
