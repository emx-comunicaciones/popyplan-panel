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
import { act, fireEvent, render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal, routerMock } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformAccount } from "@/test-utils/fixtures/platformAccount";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaUsuariosPage, { generateMetadata } from "./page";

afterEach(() => {
  vi.useRealTimers();
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const ACCOUNTS = [
  buildPlatformAccount({ id: 13, email: "p01@test.com", username: "p01", first_name: "Persona 01", is_verified: false }),
  buildPlatformAccount({ id: 59, email: "plataforma@test.com", username: "plataforma", first_name: "", is_verified: true, profile: { public_name: "Equipo", photo: null, place: null } }),
];

function mockBackend(
  list: (path: string) => unknown = () => ({ count: 2, next: null, previous: null, results: ACCOUNTS }),
) {
  apiFetchMock.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
    if (path === "/api/safety/platform-roles/") {
      return [{ user: 59, username: "plataforma", role: "superadmin", granted_by: null, created_at: "2026-09-05T00:00:00Z" }];
    }
    if (path.startsWith("/api/users/users/")) return list(path);
    if (path === "/api/auth/admin-register/" && options?.method === "POST") {
      return buildPlatformAccount({ id: 300, email: "nueva@test.com" });
    }
    throw new Error(`sin mock para ${path}`);
  });
}

function superadmin() {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ id: 59, org_memberships: [] }),
    platformRole: buildPlatformRole("superadmin"),
  });
}

describe("PlataformaUsuariosPage", () => {
  it("no tiene violaciones de accesibilidad (axe), con el diálogo «Nueva cuenta» abierto", async () => {
    mockBackend();
    superadmin();
    const { container } = render(await PlataformaUsuariosPage());
    await waitFor(() => expect(screen.getByRole("link", { name: "Persona 01" })).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: "Nueva cuenta" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Cuentas");
  });

  it("lista las cuentas con correo, usuario, verificación, rol de plataforma y enlace a la ficha con el correo", async () => {
    mockBackend();
    superadmin();
    render(await PlataformaUsuariosPage());

    expect(screen.getByRole("heading", { name: "Cuentas" })).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "Persona 01" });
    expect(link).toHaveAttribute("href", "/plataforma/usuarios/13?email=p01%40test.com");
    // Sin nombre ni apellidos, se cae al alias público.
    expect(screen.getByRole("link", { name: "Equipo" })).toBeInTheDocument();
    expect(screen.getByText("p01@test.com")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Sin verificar")).toBeInTheDocument();
    await waitFor(() => expect(within(rows[2]).getByText("Superadmin")).toBeInTheDocument());
    expect(within(rows[2]).getByText("Verificada")).toBeInTheDocument();
    // Sin filtro de estado, el estado de cada fila no se conoce: ni «Activa» ni «Desactivada».
    expect(screen.queryByText("Activa")).not.toBeInTheDocument();
    expect(screen.getByText(/filtra por «Estado»/)).toBeInTheDocument();
    expect(screen.getByText("2 cuentas")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/users/?ordering=-created_at&page=1");
  });

  it("filtrar por «Desactivadas» manda is_active=false y marca las filas", async () => {
    mockBackend((path) =>
      path.includes("is_active=false")
        ? { count: 1, next: null, previous: null, results: [ACCOUNTS[0]] }
        : { count: 2, next: null, previous: null, results: ACCOUNTS },
    );
    superadmin();
    render(await PlataformaUsuariosPage());
    await screen.findByRole("link", { name: "Persona 01" });

    await userEvent.selectOptions(screen.getByLabelText("Estado"), "false");
    await waitFor(() => expect(screen.getByText("Desactivada")).toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/users/?ordering=-created_at&page=1&is_active=false");

    await userEvent.selectOptions(screen.getByLabelText("Verificación"), "true");
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/users/users/?ordering=-created_at&page=1&is_active=false&is_verified=true",
      ),
    );
  });

  it("«Activas» marca las filas como activas", async () => {
    mockBackend();
    superadmin();
    render(await PlataformaUsuariosPage());
    await screen.findByRole("link", { name: "Persona 01" });
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "true");
    await waitFor(() => expect(screen.getAllByText("Activa")).toHaveLength(2));
  });

  it("la búsqueda va con retardo: teclear «ana» solo pide una vez", async () => {
    mockBackend();
    superadmin();
    vi.useFakeTimers();
    render(await PlataformaUsuariosPage());

    const input = screen.getByLabelText("Buscar (correo, usuario o nombre)");
    for (const value of ["a", "an", "ana"]) fireEvent.change(input, { target: { value } });
    const searches = () =>
      apiFetchMock.mock.calls.map(([path]) => String(path)).filter((path) => path.includes("search="));
    expect(searches()).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(searches()).toEqual(["/api/users/users/?ordering=-created_at&page=1&search=ana"]);
  });

  it("pagina con Anterior/Siguiente", async () => {
    mockBackend((path) =>
      path.includes("page=2")
        ? { count: 25, next: null, previous: "p1", results: [ACCOUNTS[1]] }
        : { count: 25, next: "p2", previous: null, results: [ACCOUNTS[0]] },
    );
    superadmin();
    render(await PlataformaUsuariosPage());
    await screen.findByRole("link", { name: "Persona 01" });
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("link", { name: "Equipo" });
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByRole("link", { name: "Persona 01" });
  });

  it("una página que ya no existe (404) vuelve a la primera", async () => {
    mockBackend((path) => {
      if (path.includes("page=2")) throw new ApiError(404, { detail: "Página inválida." });
      return { count: 25, next: "p2", previous: null, results: [ACCOUNTS[0]] };
    });
    superadmin();
    render(await PlataformaUsuariosPage());
    await screen.findByRole("link", { name: "Persona 01" });
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Persona 01" })).toBeInTheDocument());
  });

  it("un error del listado se pinta con su motivo, y un listado vacío con su estado vacío", async () => {
    mockBackend(() => {
      throw new ApiError(403, null);
    });
    superadmin();
    const { unmount } = render(await PlataformaUsuariosPage());
    expect(await screen.findByText("No se pudieron cargar las cuentas")).toBeInTheDocument();
    expect(screen.getByText("Solo el personal de plataforma ve las cuentas.")).toBeInTheDocument();
    unmount();

    mockBackend(() => ({ count: 0, next: null, previous: null, results: [] }));
    render(await PlataformaUsuariosPage());
    expect(await screen.findByText("No hay cuentas con estos filtros")).toBeInTheDocument();
  });

  it("«Nueva cuenta» valida en el cliente, crea la cuenta y abre su ficha", async () => {
    mockBackend();
    superadmin();
    render(await PlataformaUsuariosPage());
    await userEvent.click(screen.getByRole("button", { name: "Nueva cuenta" }));
    const dialog = screen.getByRole("dialog");
    const create = within(dialog).getByRole("button", { name: "Crear cuenta" });
    expect(create).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText("Correo"), "nueva@test.com");
    await userEvent.type(within(dialog).getByLabelText("Usuario"), "nueva");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Nueva");
    await userEvent.type(within(dialog).getByLabelText("Apellidos"), "Persona");
    await userEvent.type(within(dialog).getByLabelText("Contraseña (opcional)"), "corta");
    expect(within(dialog).getByText("La contraseña tiene que tener al menos 8 caracteres.")).toBeInTheDocument();
    expect(create).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Contraseña (opcional)"), "-larga");
    expect(create).toBeEnabled();

    await userEvent.click(create);
    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith("/plataforma/usuarios/300?email=nueva%40test.com"),
    );
    expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/admin-register/", {
      method: "POST",
      body: {
        email: "nueva@test.com",
        username: "nueva",
        first_name: "Nueva",
        last_name: "Persona",
        password: "corta-larga",
      },
    });
  });

  it("«Nueva cuenta» pinta el error literal del backend dentro del diálogo, y Cancelar lo cierra", async () => {
    mockBackend();
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/auth/admin-register/") {
        throw new ApiError(400, { username: ["Ya existe un usuario con este nombre."] });
      }
      if (path === "/api/safety/platform-roles/") return [];
      return { count: 2, next: null, previous: null, results: ACCOUNTS };
    });
    superadmin();
    render(await PlataformaUsuariosPage());
    await userEvent.click(screen.getByRole("button", { name: "Nueva cuenta" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Correo"), "x@test.com");
    await userEvent.type(within(dialog).getByLabelText("Usuario"), "p01");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear cuenta" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ya existe un usuario con este nombre.");
    expect(routerMock.push).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moderator ve «Sin acceso» sin pedir nada", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });
    render(await PlataformaUsuariosPage());
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sin sesión redirige a /login y sin rol de plataforma a /", async () => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaUsuariosPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });
    await expect(PlataformaUsuariosPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
