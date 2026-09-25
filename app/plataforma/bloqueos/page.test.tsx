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
import { buildBlockAdmin } from "@/test-utils/fixtures/platformAccount";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaBloqueosPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const BLOCKS = [
  buildBlockAdmin(),
  buildBlockAdmin({
    id: "6f1c2e8a-0000-4000-8000-000000000002",
    blocker: 13,
    blocked: null,
    blocked_username: null,
    phone_blocked: true,
  }),
];

function mockBackend(onRevoke?: () => unknown, blocks: () => unknown = () => BLOCKS) {
  apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path.startsWith("/api/users/users/")) {
      return {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 13, username: "p01", email: "p01@test.com" }],
      };
    }
    if (path.startsWith("/api/safety/blocks/admin/")) return blocks();
    if (path.endsWith("/admin/") && options?.method === "DELETE") return onRevoke ? onRevoke() : undefined;
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
  return render(await PlataformaBloqueosPage({ searchParams: Promise.resolve(query) }));
}

describe("PlataformaBloqueosPage", () => {
  it("no tiene violaciones de accesibilidad (axe), con la tabla y el diálogo de revocar abierto", async () => {
    mockBackend();
    superadmin();
    const { container } = await renderPage({ user: "13" });
    await screen.findByText("panel_demo_asociacion_bidasoa_p02");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getAllByRole("button", { name: "Revocar" })[0]);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Bloqueos");
  });

  it("sin cuenta elegida no pide bloqueos; elegirla con el buscador los carga", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    expect(screen.getByText("Elige una cuenta para ver sus bloqueos.")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Buscar cuenta (correo o usuario)"), "p01");
    await userEvent.click(await screen.findByRole("button", { name: "p01 (p01@test.com)" }));
    expect(screen.getByText(/Bloqueos de p01\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir su ficha" })).toHaveAttribute(
      "href",
      "/plataforma/usuarios/13?email=p01%40test.com",
    );
    await screen.findByText("panel_demo_asociacion_bidasoa_p02");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/blocks/admin/?user=13");
  });

  it("con ?user= pinta quién bloquea a quién, la fecha y el bloqueo por teléfono sin número", async () => {
    mockBackend();
    superadmin();
    await renderPage({ user: "13" });
    expect(screen.getByText("Bloqueos de la cuenta n.º 13.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir su ficha" })).toHaveAttribute("href", "/plataforma/usuarios/13");
    const rows = await screen.findAllByRole("row");
    expect(within(rows[1]).getByText("panel_demo_asociacion_bidasoa_p01")).toBeInTheDocument();
    expect(within(rows[1]).getByText("panel_demo_asociacion_bidasoa_p02")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Un teléfono (bloqueo preventivo)")).toBeInTheDocument();
  });

  it("con ?user=&email= el enlace a la ficha lleva el correo", async () => {
    mockBackend();
    superadmin();
    await renderPage({ user: "13", email: "p01@test.com" });
    expect(screen.getByText("Bloqueos de p01@test.com.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir su ficha" })).toHaveAttribute(
      "href",
      "/plataforma/usuarios/13?email=p01%40test.com",
    );
  });

  it("un ?user= que no es un id se ignora", async () => {
    mockBackend();
    superadmin();
    await renderPage({ user: "abc" });
    expect(screen.getByText("Elige una cuenta para ver sus bloqueos.")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("revocar exige motivo, lo manda y cierra el diálogo", async () => {
    mockBackend();
    superadmin();
    await renderPage({ user: "13" });
    await screen.findByText("panel_demo_asociacion_bidasoa_p02");
    await userEvent.click(screen.getAllByRole("button", { name: "Revocar" })[0]);
    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Revocar" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Escribe el motivo de la revocación.");

    await userEvent.type(within(dialog).getByLabelText("Motivo"), "Bloqueo por error, pedido por las dos personas");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Revocar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/blocks/6f1c2e8a-0000-4000-8000-000000000001/admin/", {
      method: "DELETE",
      body: { reason: "Bloqueo por error, pedido por las dos personas" },
    });
  });

  it("un error al revocar se queda dentro del diálogo; Cancelar lo limpia", async () => {
    mockBackend(() => {
      throw new ApiError(404, { detail: "Este bloqueo no existe." });
    });
    superadmin();
    await renderPage({ user: "13" });
    await screen.findByText("panel_demo_asociacion_bidasoa_p02");
    await userEvent.click(screen.getAllByRole("button", { name: "Revocar" })[0]);
    const dialog = screen.getByRole("alertdialog");
    await userEvent.type(within(dialog).getByLabelText("Motivo"), "x");
    await userEvent.click(within(dialog).getByRole("button", { name: "Revocar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Este bloqueo ya no existe.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("sin bloqueos pinta el estado vacío; un 404 dice que la cuenta no existe", async () => {
    mockBackend(undefined, () => []);
    superadmin();
    const { unmount } = await renderPage({ user: "13" });
    expect(await screen.findByText("Esta cuenta no tiene bloqueos")).toBeInTheDocument();
    unmount();

    mockBackend(undefined, () => {
      throw new ApiError(404, null);
    });
    await renderPage({ user: "999" });
    expect(await screen.findByText("No se pudieron cargar los bloqueos")).toBeInTheDocument();
    expect(screen.getByText("Esa cuenta no existe.")).toBeInTheDocument();
  });

  it("moderator ve «Sin acceso»; sin sesión va a /login; sin rol de plataforma a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });
    render(await PlataformaBloqueosPage({}));
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();

    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaBloqueosPage({})).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });
    await expect(PlataformaBloqueosPage({})).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
