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
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { buildContract, buildInvoice, buildPricingTier } from "@/test-utils/fixtures/billing";

import PlataformaContratosPage, { generateMetadata } from "./page";

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
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Contratos");
  });

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

  it("las pestañas anuncian cuál está activa con aria-pressed", async () => {
    mockApiFetch();
    const user = userEvent.setup();
    await renderPage("superadmin");

    expect(screen.getByRole("button", { name: "Contratos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tramos" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Tramos" }));

    expect(screen.getByRole("button", { name: "Tramos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Contratos" })).toHaveAttribute("aria-pressed", "false");
  });

  it("cambia a la pestaña Facturas y exige elegir un contrato primero", async () => {
    mockApiFetch();
    const user = userEvent.setup();
    await renderPage("superadmin");

    await user.click(screen.getByRole("button", { name: "Facturas" }));
    expect(screen.getByText("Elige un contrato para ver sus facturas")).toBeInTheDocument();
  });

  it("«Finalizar»: el error de la llamada se lee dentro del diálogo, que no se cierra", async () => {
    apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/plataforma/billing/contracts/9/end/") {
        throw new ApiError(409, { detail: "Un contrato en borrador no se puede finalizar." });
      }
      if (path.startsWith("/api/organizations/")) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      if (path === "/api/plataforma/billing/contracts/") {
        return [buildContract({ id: 9, status: "active" })];
      }
      throw new Error(`sin mock para ${path} (${options?.method ?? "GET"})`);
    });
    const user = userEvent.setup();
    await renderPage("superadmin");

    await user.click(await screen.findByRole("button", { name: "Finalizar" }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Finalizar" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Un contrato en borrador no se puede finalizar.",
      ),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("«Editar» no se ofrece en un contrato finalizado", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/organizations/")) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      if (path === "/api/plataforma/billing/contracts/") {
        return [buildContract({ id: 9, status: "ended" })];
      }
      throw new Error(`sin mock para ${path}`);
    });
    await renderPage("superadmin");

    await waitFor(() => expect(screen.getByRole("button", { name: "Ver facturas" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finalizar" })).not.toBeInTheDocument();
  });

  it("«Marcar pagada»: sin fecha avisa, y el error de la llamada se lee dentro del diálogo", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/organizations/")) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      if (path === "/api/plataforma/billing/contracts/") {
        return [buildContract({ id: 9, status: "active" })];
      }
      if (path === "/api/plataforma/billing/contracts/9/invoices/") {
        return [buildInvoice({ id: 4, status: "pending" })];
      }
      if (path === "/api/plataforma/billing/invoices/4/pay/") {
        throw new ApiError(400, { paid_on: ["La fecha de pago no puede ser anterior a la emisión."] });
      }
      throw new Error(`sin mock para ${path}`);
    });
    const user = userEvent.setup();
    await renderPage("superadmin");

    await user.click(await screen.findByRole("button", { name: "Ver facturas" }));
    await user.click(await screen.findByRole("button", { name: "Marcar pagada" }));

    const dialog = screen.getByRole("alertdialog");
    await user.clear(within(dialog).getByLabelText("Fecha de pago"));
    await user.click(within(dialog).getByRole("button", { name: "Marcar pagada" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent("Indica la fecha de pago.");

    await user.type(within(dialog).getByLabelText("Fecha de pago"), "2026-03-01");
    await user.click(within(dialog).getByRole("button", { name: "Marcar pagada" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "La fecha de pago no puede ser anterior a la emisión.",
      ),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("«Nuevo tramo»: la población máxima no puede quedar por debajo de la mínima", async () => {
    mockApiFetch();
    const user = userEvent.setup();
    await renderPage("superadmin");

    await user.click(screen.getByRole("button", { name: "Tramos" }));
    await user.click(await screen.findByRole("button", { name: "Nuevo tramo" }));

    await user.type(screen.getByLabelText("Nombre"), "Municipio grande");
    await user.clear(screen.getByLabelText("Población mínima"));
    await user.type(screen.getByLabelText("Población mínima"), "20000");
    await user.type(screen.getByLabelText("Población máxima (vacío = sin tope)"), "5000");
    await user.type(screen.getByLabelText("Precio anual (€)"), "1200.50");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La población máxima no puede ser menor que la mínima.",
    );
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/plataforma/billing/tiers/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("«Nuevo tramo»: manda el precio en céntimos con el mismo redondeo que Programas", async () => {
    mockApiFetch();
    const user = userEvent.setup();
    await renderPage("superadmin");

    await user.click(screen.getByRole("button", { name: "Tramos" }));
    await user.click(await screen.findByRole("button", { name: "Nuevo tramo" }));

    await user.type(screen.getByLabelText("Nombre"), "Municipio grande");
    await user.type(screen.getByLabelText("Precio anual (€)"), "19.99");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/plataforma/billing/tiers/",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({ annual_price_cents: 1999, max_population: null }),
        }),
      ),
    );
  });

  it("«Nueva factura»: el vencimiento no puede ser anterior a la emisión", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/organizations/")) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      if (path === "/api/plataforma/billing/contracts/") {
        return [buildContract({ id: 9, status: "active" })];
      }
      if (path === "/api/plataforma/billing/contracts/9/invoices/") {
        return [];
      }
      throw new Error(`sin mock para ${path}`);
    });
    const user = userEvent.setup();
    await renderPage("superadmin");

    await user.click(await screen.findByRole("button", { name: "Ver facturas" }));
    await user.click(await screen.findByRole("button", { name: "Nueva factura" }));

    await user.type(screen.getByLabelText("Número"), "2026-0002");
    await user.type(screen.getByLabelText("Importe (€)"), "500");
    await user.type(screen.getByLabelText("Emitida el"), "2026-03-01");
    await user.type(screen.getByLabelText("Vence el"), "2026-02-01");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La fecha de vencimiento no puede ser anterior a la de emisión.",
    );
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
