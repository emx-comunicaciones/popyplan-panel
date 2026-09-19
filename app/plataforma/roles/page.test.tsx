import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { act, fireEvent, render, screen, waitFor } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaRolesPage, { generateMetadata } from "./page";

afterEach(() => {
  vi.useRealTimers();
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

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
