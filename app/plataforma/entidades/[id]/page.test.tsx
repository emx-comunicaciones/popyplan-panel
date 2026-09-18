import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { render, screen, waitFor } from "@/test-utils/render";
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
