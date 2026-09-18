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
import { NextNotFoundSignal, NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { buildContract, buildInvoice } from "@/test-utils/fixtures/billing";

import PlataformaEntidadDetailPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

describe("PlataformaEntidadDetailPage", () => {
  it("pinta la ficha con las secciones y permite verificar", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun", is_verified: false });
      }
      throw new Error(`sin mock para ${path}`);
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    expect(screen.getByRole("heading", { name: "Ficha de la entidad" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Ayuntamiento de Irun")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Verificar entidad" })).toBeInTheDocument();
  });

  it("pinta el bloque «Contrato» con tramo, vigencia y última factura", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      if (path === "/api/plataforma/billing/contracts/?organization=9") {
        return [buildContract({ id: 4, status: "active" })];
      }
      if (path === "/api/plataforma/billing/contracts/4/invoices/") {
        return [
          buildInvoice({ id: 1, issued_on: "2026-01-05", status: "paid" }),
          buildInvoice({ id: 2, issued_on: "2026-03-05", status: "overdue", amount_cents: 60000 }),
        ];
      }
      throw new Error(`sin mock para ${path}`);
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await user.click(screen.getByRole("button", { name: "Contrato" }));

    await waitFor(() => expect(screen.getByText("Municipio pequeño")).toBeInTheDocument());
    expect(screen.getByText("Vigente")).toBeInTheDocument();
    // Última factura por `issued_on`: la del 5 de marzo (vencida), no la de enero (pagada).
    expect(screen.getByText("Vencida")).toBeInTheDocument();
    expect(screen.getByText("Última factura").closest("dl")).toHaveTextContent("600,00 €");
  });

  it("las pestañas de la ficha anuncian cuál está activa con aria-pressed", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    expect(screen.getByRole("button", { name: "Datos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ámbito" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Ámbito" }));

    expect(screen.getByRole("button", { name: "Ámbito" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Datos" })).toHaveAttribute("aria-pressed", "false");
  });

  it("Equipo: verifier ve el listado sin formularios ni «Quitar»", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      if (path.includes("/members/")) {
        return [{ id: 1, user: 4, public_name: "Ane", role: "titular" }];
      }
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await user.click(screen.getByRole("button", { name: "Equipo" }));

    await waitFor(() => expect(screen.getByText(/Ane/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Añadir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Asignar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
    expect(screen.getByText(/Tu rol de plataforma no gestiona el equipo/)).toBeInTheDocument();
  });

  it("Equipo: superadmin añade a alguien y el formulario se limpia solo si la llamada sale bien", async () => {
    const members: unknown[] = [];
    apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      if (path.includes("/members/") && options?.method === "POST") {
        throw new ApiError(400, { user: ["Esta persona ya está en el equipo."] });
      }
      if (path.includes("/members/")) return members;
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await user.click(screen.getByRole("button", { name: "Equipo" }));
    await user.type(screen.getByLabelText("Id de usuario"), "42");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    // La llamada falla: el id sigue en el campo para poder corregirlo.
    await waitFor(() =>
      expect(screen.getByText("Esta persona ya está en el equipo.")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Id de usuario")).toHaveValue(42);
  });

  it("Equipo: «Quitar» pide confirmación y el error se lee dentro del diálogo", async () => {
    apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      if (path.includes("/members/") && options?.method === "DELETE") {
        throw new ApiError(400, { detail: "La entidad se quedaría sin titular." });
      }
      if (path.includes("/members/")) {
        return [{ id: 1, user: 4, public_name: "Ane", role: "titular" }];
      }
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await user.click(screen.getByRole("button", { name: "Equipo" }));
    await user.click(await screen.findByRole("button", { name: "Quitar" }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/Ane/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Quitar" }));

    // El mensaje lo decide `useRemoveOrgMember` (hoy genérico); lo que se
    // comprueba aquí es que se lee dentro del diálogo y que este no se
    // cierra con la baja fallida.
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "No se pudo quitar a la persona del equipo.",
      ),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("no enseña rutas de documentación interna en los avisos de la ficha", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    const { container } = render(element);

    await user.click(screen.getByRole("button", { name: "Equipo" }));
    expect(container.textContent).not.toMatch(/docs\//);
    expect(container.textContent).not.toMatch(/`/);
  });

  it("moderator ve «Sin acceso»", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) })).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) })).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("un id que no es un número entero da 404 (nunca llega a pedir la ficha)", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    await expect(
      PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "no-soy-un-id" }) }),
    ).rejects.toBeInstanceOf(NextNotFoundSignal);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("un id vacío también da 404", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    await expect(
      PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "" }) }),
    ).rejects.toBeInstanceOf(NextNotFoundSignal);
  });
});
