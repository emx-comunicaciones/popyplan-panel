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
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { buildContract, buildPricingTier } from "@/test-utils/fixtures/billing";

import PlataformaContratosPage from "./page";

const CONTRACT = buildContract({
  id: 3,
  organization: { id: 7, name: "Ayuntamiento de Irun", slug: "ayuntamiento-de-irun", org_type: "administracion" },
  status: "draft",
});

function mockApiFetch() {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/organizations/")) {
      return { count: 1, next: null, previous: null, results: [buildOrganization({ id: 7, name: "Ayuntamiento de Irun" })] };
    }
    if (path === "/api/plataforma/billing/contracts/") {
      return [CONTRACT];
    }
    if (path === "/api/plataforma/billing/tiers/") {
      return [buildPricingTier()];
    }
    throw new Error(`sin mock para ${path}`);
  });
}

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

async function renderPage(role: string | null = "superadmin") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole(role),
  });

  const element = await PlataformaContratosPage();
  return render(element);
}

describe("PlataformaContratosPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockApiFetch();
    const { container } = await renderPage("superadmin");

    await waitFor(() => expect(screen.getByRole("button", { name: "Activar" })).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });

  it("superadmin ve la lista de contratos con «Nuevo contrato», «Activar» y «Editar»", async () => {
    mockApiFetch();
    await renderPage("superadmin");

    expect(screen.getByRole("heading", { name: "Contratos", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo contrato" })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "Activar" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getAllByText("Borrador").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ayuntamiento de Irun").length).toBeGreaterThan(0);
  });

  it("support ve la misma lista sin ningún botón de escritura (oculto, no deshabilitado)", async () => {
    mockApiFetch();
    await renderPage("support");

    await waitFor(() => expect(screen.getByRole("button", { name: "Ver facturas" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Nuevo contrato" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    // Sigue viendo «Ver facturas»: es una acción de lectura, no de escritura.
    expect(screen.getByRole("button", { name: "Ver facturas" })).toBeInTheDocument();
  });

  it("cambia a la pestaña Tramos y pinta el listado, sin «Nuevo tramo» para support", async () => {
    mockApiFetch();
    const user = userEvent.setup();
    await renderPage("support");

    await user.click(screen.getByRole("button", { name: "Tramos" }));
    await waitFor(() => expect(screen.getByText("Municipio pequeño")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Nuevo tramo" })).not.toBeInTheDocument();
  });

  it("cambia a la pestaña Facturas y exige elegir un contrato primero", async () => {
    mockApiFetch();
    const user = userEvent.setup();
    await renderPage("superadmin");

    await user.click(screen.getByRole("button", { name: "Facturas" }));
    expect(screen.getByText("Elige un contrato para ver sus facturas")).toBeInTheDocument();
  });

  it("verifier ve «Sin acceso» (sin lectura de facturación)", async () => {
    await renderPage("verifier");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaContratosPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaContratosPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
