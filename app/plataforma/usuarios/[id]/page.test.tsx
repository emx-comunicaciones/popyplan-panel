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
import { NextNotFoundSignal, NextRedirectSignal, routerMock } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildPlatformAccount, buildPlatformPublicProfile } from "@/test-utils/fixtures/platformAccount";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaUsuarioDetailPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const EMAIL = "p01@test.com";
const ACCOUNT = buildPlatformAccount({
  id: 13,
  email: EMAIL,
  username: "p01",
  first_name: "Persona",
  last_name: "Uno",
  is_verified: true,
  org_memberships: [
    { ...buildOrgMembership({ organization_id: 7, organization_name: "Asociación Bidasoa", role: "titular" }), is_administration: false },
  ],
});

interface BackendOptions {
  inactive?: boolean;
  profile?: () => unknown;
  onPatch?: () => unknown;
  onDelete?: () => unknown;
  onReset?: () => unknown;
}

function mockBackend({ inactive = false, profile, onPatch, onDelete, onReset }: BackendOptions = {}) {
  apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
    const method = options?.method ?? "GET";
    if (path === "/api/safety/platform-roles/") {
      return [{ user: 13, username: "p01", role: "moderator", granted_by: 2, created_at: "2026-09-05T00:00:00Z" }];
    }
    if (path.startsWith("/api/users/users/")) {
      const results = path.includes("is_active=false") ? (inactive ? [ACCOUNT] : []) : [ACCOUNT];
      return { count: results.length, next: null, previous: null, results };
    }
    if (path === "/api/users/13/" && method === "GET") return profile ? profile() : buildPlatformPublicProfile();
    if (path === "/api/users/13/" && method === "PATCH") return onPatch ? onPatch() : ACCOUNT;
    if (path === "/api/users/13/" && method === "DELETE") return onDelete ? onDelete() : undefined;
    if (path === "/api/auth/password/reset/") return onReset ? onReset() : { detail: "ok" };
    throw new Error(`sin mock para ${method} ${path}`);
  });
}

function superadmin(id = 59) {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ id, org_memberships: [] }),
    platformRole: buildPlatformRole("superadmin"),
  });
}

async function renderPage(id = "13", email: string | null = EMAIL) {
  const element = await PlataformaUsuarioDetailPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(email === null ? {} : { email }),
  });
  return render(element);
}

describe("PlataformaUsuarioDetailPage", () => {
  it("no tiene violaciones de accesibilidad (axe), con la ficha completa y el diálogo de borrar abierto", async () => {
    mockBackend();
    superadmin();
    const { container } = await renderPage();
    await screen.findByText(EMAIL);
    await screen.findByText("Irun (Gipuzkoa)");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: "Borrar cuenta" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Ficha de la cuenta");
  });

  it("pinta la cuenta, el perfil público, las entidades y el rol; nunca teléfono ni biografía", async () => {
    mockBackend();
    superadmin();
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Ficha de la cuenta" })).toBeInTheDocument();
    expect(await screen.findByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByText("Persona Uno")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText("Verificada")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Moderador")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Asociación Bidasoa" })).toHaveAttribute("href", "/plataforma/entidades/7");
    expect(await screen.findByText("Irun (Gipuzkoa)")).toBeInTheDocument();
    expect(screen.getByText("Teléfono verificado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver sus bloqueos" })).toHaveAttribute(
      "href",
      "/plataforma/bloqueos?user=13&email=p01%40test.com",
    );
    expect(screen.getByRole("link", { name: "Volver a las cuentas" })).toHaveAttribute("href", "/plataforma/usuarios");
    expect(screen.queryByText(/Teléfono:/)).not.toBeInTheDocument();
  });

  it("desactiva con confirmación y manda is_active=false", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Desactivar" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("¿Desactivar esta cuenta?")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/13/", { method: "PATCH", body: { is_active: false } });
  });

  it("una cuenta desactivada se ofrece reactivar; un error se pinta dentro del diálogo y Cancelar lo limpia", async () => {
    mockBackend({
      inactive: true,
      onPatch: () => {
        throw new ApiError(403, null);
      },
    });
    superadmin();
    await renderPage();
    expect(await screen.findByText("Desactivada")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("¿Reactivar esta cuenta?")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Reactivar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Solo el personal de plataforma puede hacer esto.",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("borra con confirmación y vuelve al listado", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await screen.findByText(EMAIL);
    await userEvent.click(screen.getByRole("button", { name: "Borrar cuenta" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Borrar cuenta" }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/plataforma/usuarios"));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/13/", { method: "DELETE" });
  });

  it("un error al borrar se queda dentro del diálogo con el texto del backend", async () => {
    mockBackend({
      onDelete: () => {
        throw new ApiError(400, { error: "No puedes borrar tu propia cuenta desde aquí" });
      },
    });
    superadmin();
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Borrar cuenta" }));
    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar cuenta" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No puedes borrar tu propia cuenta desde aquí");
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("envía el restablecimiento de contraseña y avisa; un 429 se explica", async () => {
    let calls = 0;
    mockBackend({
      onReset: () => {
        calls += 1;
        if (calls > 1) throw new ApiError(429, null);
        return { detail: "ok" };
      },
    });
    superadmin();
    await renderPage();
    const button = await screen.findByRole("button", { name: "Enviar restablecimiento de contraseña" });
    await userEvent.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent(`Se ha enviado un código de restablecimiento a ${EMAIL}.`);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/password/reset/", { method: "POST", body: { email: EMAIL } });
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos");
  });

  it("sobre la propia cuenta no ofrece desactivar ni borrar", async () => {
    mockBackend();
    superadmin(13);
    await renderPage();
    await screen.findByText(EMAIL);
    expect(screen.queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar cuenta" })).not.toBeInTheDocument();
    expect(screen.getByText(/Es tu propia cuenta/)).toBeInTheDocument();
  });

  it("sin correo en la URL: explica cómo llegar a los datos de cuenta y no pide el listado", async () => {
    mockBackend();
    superadmin();
    await renderPage("13", null);
    expect(screen.getByText(/Abre la ficha desde el listado de cuentas/)).toBeInTheDocument();
    expect(await screen.findByText("Persona 01")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar restablecimiento de contraseña" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver sus bloqueos" })).toHaveAttribute("href", "/plataforma/bloqueos?user=13");
    expect(
      apiFetchMock.mock.calls.map(([path]) => String(path)).some((path) => path.startsWith("/api/users/users/")),
    ).toBe(false);
  });

  it("un correo que no casa con el id, un perfil suspendido (404) y un nivel desconocido", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/safety/platform-roles/") return [];
      if (path.startsWith("/api/users/users/")) {
        return { count: 1, next: null, previous: null, results: [buildPlatformAccount({ id: 99 })] };
      }
      if (path === "/api/users/13/") throw new ApiError(404, { error: "User not found" });
      throw new Error(path);
    });
    superadmin();
    await renderPage();
    expect(await screen.findByText("No hay ninguna cuenta con este correo y este id")).toBeInTheDocument();
    expect(await screen.findByText(/la cuenta no existe o está suspendida/)).toBeInTheDocument();
  });

  it("un error al cargar la cuenta se pinta, y un nivel de verificación desconocido sale como número", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/safety/platform-roles/") return [];
      if (path.startsWith("/api/users/users/")) throw new ApiError(500, null);
      if (path === "/api/users/13/") return buildPlatformPublicProfile({ verification_level: 7, place: null });
      throw new Error(path);
    });
    superadmin();
    await renderPage();
    expect(await screen.findByText("No se pudieron cargar los datos de la cuenta")).toBeInTheDocument();
    expect(await screen.findByText("7")).toBeInTheDocument();
  });

  it("id no numérico es 404 sin pedir sesión", async () => {
    await expect(
      PlataformaUsuarioDetailPage({ params: Promise.resolve({ id: "abc" }) }),
    ).rejects.toBeInstanceOf(NextNotFoundSignal);
    expect(getServerSessionMock).not.toHaveBeenCalled();
  });

  it("moderator ve «Sin acceso»; sin sesión va a /login; sin rol de plataforma a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });
    render(await PlataformaUsuarioDetailPage({ params: Promise.resolve({ id: "13" }) }));
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();

    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaUsuarioDetailPage({ params: Promise.resolve({ id: "13" }) })).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });
    await expect(PlataformaUsuarioDetailPage({ params: Promise.resolve({ id: "13" }) })).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
