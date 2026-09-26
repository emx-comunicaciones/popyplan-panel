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
import { NextRedirectSignal, routerMock } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { GAME_ID, buildTreasureGame } from "@/test-utils/fixtures/treasureHunt";

import PlataformaTesoroPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
  routerMock.push.mockReset();
});

function superadmin() {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole("superadmin"),
  });
}

const GAMES = [
  buildTreasureGame(),
  buildTreasureGame({
    id: "11111111-2222-4333-8444-555555555555",
    name: "Tesoro de Irun",
    status: "open",
    participants_count: 12,
    max_participants: null,
    steps_count: 3,
    is_featured: true,
  }),
];

function mockBackend(list: () => unknown = () => GAMES, onPost?: () => unknown, onDelete?: () => unknown) {
  apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
    const method = options?.method ?? "GET";
    if (path === "/api/treasure-hunt/" && method === "GET") return list();
    if (path === "/api/treasure-hunt/" && method === "POST") return onPost ? onPost() : buildTreasureGame();
    if (path.startsWith("/api/treasure-hunt/") && method === "DELETE") return onDelete ? onDelete() : undefined;
    throw new Error(`sin mock para ${method} ${path}`);
  });
}

describe("PlataformaTesoroPage", () => {
  it("no tiene violaciones de accesibilidad (axe), con el listado y «Nuevo juego» abierto", async () => {
    mockBackend();
    superadmin();
    const { container } = render(await PlataformaTesoroPage());
    await screen.findByText("Tesoro de Irun");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: "Nuevo juego" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Búsqueda del tesoro");
  });

  it("pinta la tabla con estado, participantes, pruebas y destacado", async () => {
    mockBackend();
    superadmin();
    render(await PlataformaTesoroPage());
    expect(screen.getByRole("heading", { level: 1, name: "Búsqueda del tesoro" })).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "Búsqueda del tesoro de Donostia" });
    expect(link).toHaveAttribute("href", `/plataforma/busca-del-tesoro/${GAME_ID}`);
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.getByText("Inscripciones abiertas")).toBeInTheDocument();
    expect(screen.getByText("0 de 50")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getAllByText("Destacado").length).toBeGreaterThan(1);
  });

  it("un error del listado y un listado vacío tienen su estado", async () => {
    mockBackend(() => {
      throw new ApiError(403, null);
    });
    superadmin();
    const first = render(await PlataformaTesoroPage());
    expect(await screen.findByText("No se pudieron cargar los juegos")).toBeInTheDocument();
    expect(screen.getByText("Solo superadmin puede gestionar la búsqueda del tesoro.")).toBeInTheDocument();
    first.unmount();

    mockBackend(() => []);
    render(await PlataformaTesoroPage());
    expect(await screen.findByText("Todavía no hay juegos")).toBeInTheDocument();
  });

  it("«Nuevo juego» valida, crea siempre individual y abre su ficha", async () => {
    mockBackend();
    superadmin();
    render(await PlataformaTesoroPage());
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo juego" }));
    const dialog = screen.getByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Crear juego" });
    expect(submit).toBeDisabled();
    expect(within(dialog).getByText(/solo admite juego individual/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/pago/i)).not.toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Búsqueda del tesoro de prueba");
    await userEvent.type(within(dialog).getByLabelText("Descripción"), "Pistas por la ciudad");
    await userEvent.type(within(dialog).getByLabelText("Ciudad"), "Donostia");
    await userEvent.type(within(dialog).getByLabelText("Premio"), "Una tabla de surf");
    await userEvent.type(within(dialog).getByLabelText("Inicio"), "2020-01-01T10:00");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("El inicio tiene que ser una fecha futura.");
    expect(submit).toBeDisabled();

    await userEvent.clear(within(dialog).getByLabelText("Inicio"));
    await userEvent.type(within(dialog).getByLabelText("Inicio"), "2031-05-01T10:00");
    await userEvent.type(within(dialog).getByLabelText("Máximo de participantes"), "40");
    await userEvent.click(within(dialog).getByLabelText("Juego destacado"));
    await userEvent.click(submit);

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith(`/plataforma/busca-del-tesoro/${GAME_ID}`));
    const [, options] = apiFetchMock.mock.calls.find(([, o]) => o?.method === "POST") as [string, { body: Record<string, unknown> }];
    expect(options.body).toMatchObject({
      name: "Búsqueda del tesoro de prueba",
      city: "Donostia",
      game_mode: "individual",
      duration_minutes: 120,
      max_participants: 40,
      is_featured: true,
    });
    expect(options.body).not.toHaveProperty("is_paid");
    expect(typeof options.body.start_time).toBe("string");
  });

  it("una imagen no admitida se rechaza en el cliente", async () => {
    mockBackend();
    superadmin();
    render(await PlataformaTesoroPage());
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo juego" }));
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByLabelText("Imagen");
    await userEvent.upload(input, new File(["x"], "logo.gif", { type: "image/png" }), { applyAccept: false });
    expect(within(dialog).getByText("Formato no admitido: usa PNG, JPG o WEBP.")).toBeInTheDocument();
    await userEvent.upload(input, new File(["x"], "ok.png", { type: "image/png" }));
    expect(within(dialog).getByText(/hasta 5 MB. Opcional/)).toBeInTheDocument();
  });

  it("un 400 al crear se pinta literal dentro del diálogo, y Cancelar lo cierra", async () => {
    mockBackend(undefined, () => {
      throw new ApiError(400, { is_paid: ["Los juegos de pago llegarán más adelante."] });
    });
    superadmin();
    render(await PlataformaTesoroPage());
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo juego" }));
    const dialog = screen.getByRole("dialog");
    for (const [label, value] of [
      ["Nombre", "x"],
      ["Descripción", "x"],
      ["Ciudad", "x"],
      ["Premio", "x"],
      ["Inicio", "2031-05-01T10:00"],
    ]) {
      await userEvent.type(within(dialog).getByLabelText(label), value);
    }
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear juego" }));
    expect(await within(dialog).findByText("Los juegos de pago llegarán más adelante.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("borra con confirmación; un error se queda dentro del diálogo", async () => {
    let fail = true;
    mockBackend(undefined, undefined, () => {
      if (fail) throw new ApiError(500, null);
      return undefined;
    });
    superadmin();
    render(await PlataformaTesoroPage());
    await screen.findByText("Tesoro de Irun");
    await userEvent.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/Búsqueda del tesoro de Donostia/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se pudo completar la operación.");

    fail = false;
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/`, { method: "DELETE" });
  });

  it("Cancelar el borrado no borra nada", async () => {
    mockBackend();
    superadmin();
    render(await PlataformaTesoroPage());
    await screen.findByText("Tesoro de Irun");
    await userEvent.click(screen.getAllByRole("button", { name: "Borrar" })[1]);
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("moderator ve «Sin acceso» sin pedir nada", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });
    render(await PlataformaTesoroPage());
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sin sesión redirige a /login y sin rol de plataforma a /", async () => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaTesoroPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });
    await expect(PlataformaTesoroPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
