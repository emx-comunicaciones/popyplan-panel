import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});
const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { routerMock } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import {
  CRM_STAGES,
  CRM_USER,
  CRM_USER_2,
  buildCrmAccount,
  buildCrmOpportunity,
  paginated,
} from "@/test-utils/fixtures/crm";
import { CRM_PRODUCTS, buildCrmRenewal } from "@/test-utils/fixtures/crm-b";

import PlataformaComercialOportunidadesPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

function mockApi() {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (path === "/api/crm/opportunities/" && init?.method === "POST") return buildCrmOpportunity({ id: 77 });
    if (path.startsWith("/api/crm/opportunities/")) return paginated([buildCrmOpportunity()]);
    if (path.startsWith("/api/crm/renewals/")) return [buildCrmRenewal()];
    if (path.startsWith("/api/crm/stages/")) return CRM_STAGES;
    if (path.startsWith("/api/crm/catalog/")) return CRM_PRODUCTS;
    if (path === "/api/crm/users/") return [CRM_USER, CRM_USER_2];
    if (path.startsWith("/api/crm/accounts/")) return paginated([buildCrmAccount()]);
    throw new Error(`sin mock para ${path}`);
  });
}

async function renderPage(role = "sales") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole(role as never),
  });
  return render(await PlataformaComercialOportunidadesPage());
}

describe("PlataformaComercialOportunidadesPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockApi();
    const { container } = await renderPage();
    await screen.findByRole("link", { name: "Popyplan Asociaciones" });
    await screen.findByRole("table", { name: "Contratos próximos a renovar" });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("lista las oportunidades con importes, fase y enlaces", async () => {
    mockApi();
    await renderPage();
    const table = await screen.findByRole("table", { name: "Oportunidades comerciales" });
    const row = within(table).getByRole("link", { name: "Popyplan Asociaciones" }).closest("tr") as HTMLElement;
    expect(within(row).getByRole("link", { name: "Popyplan Asociaciones" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/oportunidades/30",
    );
    expect(within(row).getByRole("link", { name: "Ayuntamiento de Donostia" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/entidades/1",
    );
    expect(within(row).getByText("Propuesta enviada")).toBeInTheDocument();
    expect(within(row).getByText(/8000\s€/)).toBeInTheDocument();
    expect(within(row).getByText(/7500\s€/)).toBeInTheDocument();
  });

  it("filtra por estado y ordena enviando los parámetros al backend", async () => {
    mockApi();
    await renderPage();
    await screen.findByRole("link", { name: "Popyplan Asociaciones" });
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "won");
    await userEvent.selectOptions(screen.getByLabelText("Ordenar por"), "-amount");
    await waitFor(() =>
      expect(
        apiFetchMock.mock.calls.some(([p]) => String(p).includes("status=won") && String(p).includes("ordering=-amount")),
      ).toBe(true),
    );
    expect(screen.queryByLabelText("Responsable")).not.toBeInTheDocument();
  });

  it("lista los contratos próximos a renovar", async () => {
    mockApi();
    await renderPage();
    const table = await screen.findByRole("table", { name: "Contratos próximos a renovar" });
    expect(within(table).getByText("40 días")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Ayuntamiento de Donostia" })).toBeInTheDocument();
  });

  it("crea una oportunidad y navega a su ficha", async () => {
    mockApi();
    await renderPage("sales_lead");
    await screen.findByRole("link", { name: "Popyplan Asociaciones" });
    await userEvent.click(screen.getByRole("button", { name: "+ Nueva oportunidad" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva oportunidad" });
    const create = within(dialog).getByRole("button", { name: "Crear oportunidad" });
    expect(create).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Entidad"), "Donostia");
    await userEvent.click(await within(dialog).findByRole("button", { name: /Ayuntamiento de Donostia/ }));
    await userEvent.type(within(dialog).getByLabelText("Nombre de la oportunidad"), "Popyplan Deporte");
    await userEvent.type(within(dialog).getByLabelText("Importe estimado (€)"), "5000");
    await within(dialog).findByRole("option", { name: "Carlos Pérez" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Responsable"), "43");
    await userEvent.click(create);
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/plataforma/comercial/oportunidades/77"));
    const call = apiFetchMock.mock.calls.find(([p, init]) => p === "/api/crm/opportunities/" && init?.method === "POST")!;
    expect(call[1].body).toEqual({
      account: 1,
      name: "Popyplan Deporte",
      estimated_amount: "5000",
      owner: 43,
    });
  });
});
