import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { ApiError } from "@/lib/api/client";
import userEvent from "@testing-library/user-event";

import { act, fireEvent, render, screen, waitFor, within } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaRolesPage, { generateMetadata } from "./page";

afterEach(() => {
  vi.useRealTimers();
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

/** Resultados de `GET /api/users/users/?search=` para los tests de conceder. */
function cuentasBuscadas(path: string) {
  const cuentas = [
    { id: 7, username: "ana", email: "ana@example.com" },
    { id: 9, username: "luis", email: "luis@example.com" },
  ];
  const buscado = new URLSearchParams(path.split("?")[1] ?? "").get("search") ?? "";
  const results = cuentas.filter((c) => c.username.includes(buscado));
  return { count: results.length, next: null, previous: null, results };
}

/** Elige una cuenta en el buscador de «Conceder rol» (`AccountPicker`). */
async function elegirCuenta(username: string) {
  const cambiar = screen.queryByRole("button", { name: "Cambiar" });
  if (cambiar) await userEvent.click(cambiar);
  await userEvent.type(screen.getByLabelText("Buscar cuenta (email o usuario)"), username);
  await userEvent.click(await screen.findByRole("button", { name: `${username} (${username}@example.com)` }));
}

describe("PlataformaRolesPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Roles de plataforma");
  });

  it("superadmin ve los roles vigentes", async () => {
    apiFetchMock.mockResolvedValueOnce([
      { user: 1, username: "ana", role: "moderator", granted_by: 2, created_at: "2026-09-01T00:00:00Z" },
    ]);
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaRolesPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Roles" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/ana \(#1\)/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Conceder" })).toBeInTheDocument();
  });

  /**
   * El buscador de cuentas va con retardo (`hooks/useDebouncedValue.ts`):
   * `useUserSearch` ya solo busca desde dos caracteres, pero tecla a
   * tecla «ana» pedía «an» y «ana». Con `fireEvent.change` (una tecla
   * por llamada) y no `userEvent`, que se queda colgado con
   * `vi.useFakeTimers()`.
   */
  it("el buscador de cuentas va con retardo: teclear «ana» solo busca una vez", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/users/users/")) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    vi.useFakeTimers();

    const element = await PlataformaRolesPage();
    render(element);

    const input = screen.getByLabelText("Buscar cuenta (email o usuario)");
    for (const value of ["a", "an", "ana"]) {
      fireEvent.change(input, { target: { value } });
    }

    expect(input).toHaveValue("ana");
    const searches = () =>
      apiFetchMock.mock.calls
        .map(([path]) => String(path))
        .filter((path) => path.startsWith("/api/users/users/"));
    expect(searches()).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(searches()).toEqual(["/api/users/users/?search=ana"]);
  });

  it("un fallo real de la búsqueda de cuentas se avisa (un 403 seguiría cayendo a lista vacía)", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/users/users/")) throw new ApiError(500, null);
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    render(await PlataformaRolesPage());
    fireEvent.change(screen.getByLabelText("Buscar cuenta (email o usuario)"), { target: { value: "ana" } });
    expect(await screen.findByText("No se pudo buscar cuentas.")).toHaveAttribute("role", "alert");
  });

  it("revocarse el propio rol avisa, y si es el último superadmin el 409 sale dentro del diálogo", async () => {
    // Informe de pruebas 2026-09-25: el único superadmin podía revocarse.
    const detail = "La plataforma no puede quedarse sin superadmin. Concede antes el rol a otra persona.";
    apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === "DELETE") throw new ApiError(409, { detail });
      return [
        { user: 42, username: "yo", role: "superadmin", granted_by: 42, created_at: "2026-09-01T00:00:00Z" },
        { user: 7, username: "ana", role: "moderator", granted_by: 42, created_at: "2026-09-01T00:00:00Z" },
      ];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ id: 42, org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    render(await PlataformaRolesPage());

    const fila = (await screen.findByText(/yo \(#42\)/)).closest("li") as HTMLElement;
    await userEvent.click(within(fila).getByRole("button", { name: "Revocar" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Es tu propio rol: perderás el acceso a esta sección.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Revocar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(detail);

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    const otra = screen.getByText(/ana \(#7\)/).closest("li") as HTMLElement;
    await userEvent.click(within(otra).getByRole("button", { name: "Revocar" }));
    const segundo = screen.getByRole("alertdialog");
    expect(segundo).not.toHaveTextContent("Es tu propio rol");
    expect(within(segundo).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("conceder un rol a quien ya tiene otro avisa de cuál pierde y no llama hasta confirmar", async () => {
    // Informe del panel, error 54: el rol vigente se sustituía sin avisar.
    apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === "POST") return { user: 7, username: "ana", role: "verifier" };
      if (path.startsWith("/api/users/users/")) return cuentasBuscadas(path);
      return [{ user: 7, username: "ana", role: "moderator", granted_by: 2, created_at: "2026-09-01T00:00:00Z" }];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ id: 42, org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    render(await PlataformaRolesPage());
    await screen.findByText(/ana \(#7\)/);

    await elegirCuenta("ana");
    await userEvent.selectOptions(screen.getByLabelText("Rol"), "verifier");
    await userEvent.click(screen.getByRole("button", { name: "Conceder" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("La cuenta #7 ya tiene el rol «Moderador»");
    expect(dialog).toHaveTextContent("al conceder «Verificador» perderá «Moderador»");
    expect(apiFetchMock).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "POST" }));

    // Cancelar no toca nada.
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "POST" }));

    // Confirmar sí concede.
    await userEvent.click(screen.getByRole("button", { name: "Conceder" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Sustituir rol" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/platform-roles/", {
        method: "POST",
        body: { user: 7, role: "verifier" },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("conceder un rol a quien no tiene ninguno, o el mismo que ya tiene, no pide confirmación", async () => {
    apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === "POST") return { user: 9, username: "luis", role: "support" };
      if (path.startsWith("/api/users/users/")) return cuentasBuscadas(path);
      return [{ user: 7, username: "ana", role: "moderator", granted_by: 2, created_at: "2026-09-01T00:00:00Z" }];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ id: 42, org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    render(await PlataformaRolesPage());
    await screen.findByText(/ana \(#7\)/);

    await elegirCuenta("luis");
    await userEvent.click(screen.getByRole("button", { name: "Conceder" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/platform-roles/", {
        method: "POST",
        body: { user: 9, role: "moderator" },
      }),
    );

    apiFetchMock.mockClear();
    await elegirCuenta("ana");
    await userEvent.click(screen.getByRole("button", { name: "Conceder" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("moderator ve «Sin acceso»", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaRolesPage();
    render(element);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaRolesPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaRolesPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
