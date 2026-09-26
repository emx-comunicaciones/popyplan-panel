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
import type { PlatformChatMessage } from "@/lib/api/types";
import { render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextNotFoundSignal, NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaChatPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const ROOM_ID = "fd549523-c4f6-4f29-a94f-c6c314c0426d";
const person = (id: number, name: string) => ({
  id,
  public_name: name,
  first_name: name,
  last_name: "",
  photo: null,
  verification_level: 0,
});

const ROOM = {
  id: ROOM_ID,
  chat_type: "individual",
  name: null,
  participants: [person(13, "Persona 01"), person(14, "Persona 02")],
  group_source: null,
};

const MESSAGES: PlatformChatMessage[] = [
  {
    id: "m1",
    sender: person(13, "Persona 01"),
    message_type: "text",
    content: "Hola, necesito ayuda con mi cuenta",
    image: null,
    is_deleted: false,
    created_at: "2026-09-25T10:00:00+02:00",
  },
  {
    id: "m2",
    sender: person(14, "Persona 02"),
    message_type: "image",
    content: "",
    image: "http://localhost:8001/media/x.jpg",
    is_deleted: false,
    created_at: "2026-09-25T10:01:00+02:00",
  },
  {
    id: "m3",
    sender: null,
    message_type: "system",
    content: "no se ve",
    image: null,
    is_deleted: true,
    created_at: "2026-09-25T10:02:00+02:00",
  },
];

type Handler = (path: string, options?: { method?: string; body?: unknown }) => unknown;

function mockBackend(overrides: Handler = () => undefined) {
  apiFetchMock.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
    const custom = overrides(path, options);
    if (custom !== undefined) return custom;
    if (path.endsWith("/messages/") && options?.method === "POST") return { ...MESSAGES[0], id: "m4" };
    if (path.endsWith("/messages/")) return MESSAGES;
    if (path === `/api/admin/chats/${ROOM_ID}/`) return ROOM;
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

async function renderPage(id = ROOM_ID) {
  return render(await PlataformaChatPage({ params: Promise.resolve({ id }) }));
}

describe("PlataformaChatPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockBackend();
    superadmin();
    const { container } = await renderPage();
    await screen.findByText("Hola, necesito ayuda con mi cuenta");
    await screen.findByText("Persona 01, Persona 02 · Entre dos personas");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Conversación");
  });

  it("avisa de que es acceso de soporte, con tu cuenta y sin auditoría", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    const note = screen.getByRole("note");
    expect(within(note).getByText(/aparece con tu propia cuenta y tu alias/)).toBeInTheDocument();
    expect(within(note).getByText(/no registra en Auditoría/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a los chats" })).toHaveAttribute("href", "/plataforma/chats");
  });

  it("pinta participantes y mensajes: texto, imagen, borrado y sistema", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    const list = await screen.findByRole("list", { name: "Mensajes" });
    const items = within(list).getAllByRole("listitem");
    expect(within(items[0]).getByText("Hola, necesito ayuda con mi cuenta")).toBeInTheDocument();
    expect(within(items[1]).getByText("[imagen]")).toBeInTheDocument();
    expect(within(items[2]).getByText("Mensaje borrado")).toBeInTheDocument();
    expect(within(items[2]).getByText("Sistema")).toBeInTheDocument();
    expect(within(items[2]).queryByText("no se ve")).not.toBeInTheDocument();
    expect(await screen.findByText("Persona 02", { selector: "li" })).toBeInTheDocument();
  });

  it("responder manda {content}, limpia y avisa; un 400 se lee tal cual", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await screen.findByText("Hola, necesito ayuda con mi cuenta");
    const send = screen.getByRole("button", { name: "Enviar" });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Mensaje"), "  Hola, soy soporte de Popyplan  ");
    await userEvent.click(send);
    expect(await screen.findByRole("status")).toHaveTextContent("Mensaje enviado.");
    expect(screen.getByLabelText("Mensaje")).toHaveValue("");
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/admin/chats/${ROOM_ID}/messages/`, {
      method: "POST",
      body: { content: "Hola, soy soporte de Popyplan" },
    });

    mockBackend((path, options) => {
      if (options?.method === "POST") throw new ApiError(400, { content: "Debes enviar texto o una imagen." });
      return undefined;
    });
    await userEvent.type(screen.getByLabelText("Mensaje"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Debes enviar texto o una imagen.");
  });

  it("sin mensajes ni participantes lo dice; los errores de carga pintan ErrorState", async () => {
    mockBackend((path) => {
      if (path.endsWith("/messages/")) return [];
      if (path.endsWith("/")) return { ...ROOM, participants: [], name: "Soporte" };
      return undefined;
    });
    superadmin();
    const { unmount } = await renderPage();
    expect(await screen.findByText("Esta conversación no tiene mensajes.")).toBeInTheDocument();
    expect(await screen.findByText("Sin participantes visibles.")).toBeInTheDocument();
    unmount();

    mockBackend(() => {
      throw new ApiError(404, null);
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText("No se pudo cargar la conversación")).toBeInTheDocument());
    expect(screen.getByText("No se pudieron cargar los mensajes")).toBeInTheDocument();
  });

  it("un id que no es UUID es 404; moderator ve «Sin acceso»; sin sesión va a /login y sin rol a /", async () => {
    await expect(PlataformaChatPage({ params: Promise.resolve({ id: "abc" }) })).rejects.toBeInstanceOf(
      NextNotFoundSignal,
    );

    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });
    await renderPage();
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();

    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaChatPage({ params: Promise.resolve({ id: ROOM_ID }) })).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });
    await expect(PlataformaChatPage({ params: Promise.resolve({ id: ROOM_ID }) })).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
