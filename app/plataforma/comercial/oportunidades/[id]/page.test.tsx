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
import { NextNotFoundSignal, routerMock } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import {
  CRM_STAGES,
  CRM_USER,
  CRM_USER_2,
  buildCrmActivity,
  buildCrmContact,
  buildCrmOpportunity,
  buildCrmProposal,
  paginated,
  stageByKey,
} from "@/test-utils/fixtures/crm";
import { CRM_PRODUCTS, buildCrmContract } from "@/test-utils/fixtures/crm-b";
import type { CrmOpportunity } from "@/lib/api/crmTypes";

import PlataformaComercialOportunidadFichaPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

function mockApi(opportunity: CrmOpportunity = buildCrmOpportunity(), proposals = [buildCrmProposal()]) {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? "GET";
    if (path === "/api/crm/opportunities/30/" && method === "GET") return opportunity;
    if (path === "/api/crm/opportunities/30/" && method === "PATCH") return opportunity;
    if (path === "/api/crm/opportunities/30/" && method === "DELETE") return undefined;
    if (path === "/api/crm/opportunities/30/proposals/" && method === "GET") return proposals;
    if (path === "/api/crm/opportunities/30/proposals/" && method === "POST") return buildCrmProposal({ id: 601, version: 2 });
    if (/\/api\/crm\/proposals\/\d+\/$/.test(path) && method === "PATCH") return buildCrmProposal();
    if (/\/api\/crm\/contracts\/\d+\/$/.test(path) && method === "PATCH") return buildCrmContract();
    if (/\/opportunities\/30\/(move|win)\/$/.test(path) && method === "POST") return {};
    if (path.startsWith("/api/crm/activities/")) return paginated([buildCrmActivity({ opportunity: 30, title: "Demo a Servicios Sociales" })]);
    if (path.startsWith("/api/crm/accounts/1/contacts/")) return [buildCrmContact({ id: 7, first_name: "María", last_name: "Etxeberria" })];
    if (path.startsWith("/api/crm/stages/")) return CRM_STAGES;
    if (path.startsWith("/api/crm/catalog/")) return CRM_PRODUCTS;
    if (path === "/api/crm/users/") return [CRM_USER, CRM_USER_2];
    throw new Error(`sin mock para ${method} ${path}`);
  });
}

async function renderPage(role = "sales", id = "30") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole(role as never),
  });
  return render(await PlataformaComercialOportunidadFichaPage({ params: Promise.resolve({ id }) }));
}

const posts = (needle: RegExp) =>
  apiFetchMock.mock.calls.filter(([p, init]) => needle.test(p) && init?.method === "POST");

describe("PlataformaComercialOportunidadFichaPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockApi(buildCrmOpportunity({ contract: buildCrmContract() }));
    const { container } = await renderPage();
    await screen.findByRole("heading", { name: "Popyplan Asociaciones", level: 1 });
    await screen.findByRole("table", { name: "Versiones de la propuesta" });
    await screen.findByRole("table", { name: "Actividades de la oportunidad" });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("un id no numérico es 404", async () => {
    await expect(renderPage("sales", "abc")).rejects.toBeInstanceOf(NextNotFoundSignal);
  });

  it("pinta la cabecera con entidad, fase e importes", async () => {
    mockApi();
    await renderPage();
    expect(await screen.findByRole("heading", { name: "Popyplan Asociaciones", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ayuntamiento de Donostia" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/entidades/1",
    );
    expect(screen.getByLabelText("Cambiar de fase")).toHaveValue("6");
    expect(screen.getByText("1 día")).toBeInTheDocument();
    expect(screen.getByText("Demo a Servicios Sociales")).toBeInTheDocument();
  });

  it("muestra el motivo si está perdida", async () => {
    mockApi(
      buildCrmOpportunity({
        stage: 11,
        stage_detail: stageByKey("perdido"),
        lost_reason: "price",
        lost_detail: "Demasiado caro para este año",
      }),
    );
    await renderPage();
    expect(await screen.findByText(/Oportunidad perdida: /)).toBeInTheDocument();
    expect(screen.getByText("Demasiado caro para este año")).toBeInTheDocument();
  });

  it("cambiar a una fase de perdido pide motivo y llama a /move/", async () => {
    mockApi();
    await renderPage();
    await userEvent.selectOptions(await screen.findByLabelText("Cambiar de fase"), "Perdido");
    const dialog = await screen.findByRole("dialog", { name: "Perder «Popyplan Asociaciones»" });
    expect(posts(/move\/$/)).toHaveLength(0);
    await userEvent.selectOptions(within(dialog).getByLabelText("Motivo"), "competitor");
    await userEvent.click(within(dialog).getByRole("button", { name: "Marcar como perdida" }));
    await waitFor(() => expect(posts(/move\/$/)).toHaveLength(1));
    expect(posts(/move\/$/)[0][1].body).toEqual({ stage: 11, lost_reason: "competitor", lost_detail: "" });
  });

  it("cambiar a ganado abre el contrato y llama a /win/", async () => {
    mockApi();
    await renderPage();
    await userEvent.selectOptions(await screen.findByLabelText("Cambiar de fase"), "Ganado");
    const dialog = await screen.findByRole("dialog", { name: /Registrar contrato/ });
    await userEvent.click(within(dialog).getByRole("button", { name: "Registrar contrato" }));
    await waitFor(() => expect(posts(/win\/$/)).toHaveLength(1));
    expect(posts(/win\/$/)[0][1].body).toMatchObject({ final_amount: "7500.00", product: 40 });
  });

  it("guarda la edición con un PATCH que incluye contratación pública", async () => {
    mockApi();
    await renderPage();
    const form = await screen.findByRole("form", { name: "Datos de la oportunidad" });
    expect(within(form).getByText(/solo guarda lo que la administración comunica/)).toBeInTheDocument();
    await within(form).findAllByRole("option", { name: "María Etxeberria" });
    await userEvent.selectOptions(within(form).getByLabelText("Contacto técnico"), "7");
    await userEvent.click(within(form).getByLabelText("Con subvención"));
    await userEvent.type(within(form).getByLabelText("Presupuesto disponible (€)"), "9000");
    await userEvent.click(within(form).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(
        apiFetchMock.mock.calls.some(([p, init]) => p === "/api/crm/opportunities/30/" && init?.method === "PATCH"),
      ).toBe(true),
    );
    const call = apiFetchMock.mock.calls.find(([p, init]) => init?.method === "PATCH" && p === "/api/crm/opportunities/30/")!;
    expect(call[1].body).toMatchObject({
      has_subsidy: true,
      available_budget: "9000",
      technical_contact: 7,
      administrative_contact: null,
      file_number: "EXP-2026/123",
    });
    expect(call[1].body).not.toHaveProperty("owner");
    expect(await screen.findByText("Cambios guardados.")).toBeInTheDocument();
  });

  it("el responsable solo se edita en dirección comercial", async () => {
    mockApi();
    await renderPage("sales_lead");
    const form = await screen.findByRole("form", { name: "Datos de la oportunidad" });
    expect(within(form).getByLabelText("Responsable")).toBeInTheDocument();
  });

  it("lista las versiones de propuesta y cambia el estado de una", async () => {
    mockApi(buildCrmOpportunity(), [
      buildCrmProposal({ id: 600, version: 1, amount: "8000.00", status: "sent" }),
      buildCrmProposal({ id: 601, version: 2, amount: "7500.00", status: "draft", number: "P-002" }),
    ]);
    await renderPage();
    const table = await screen.findByRole("table", { name: "Versiones de la propuesta" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("v2")).toBeInTheDocument();
    expect(within(rows[1]).getByText("v1")).toBeInTheDocument();
    await userEvent.selectOptions(within(rows[0]).getByLabelText("Estado de la versión 2"), "Enviada");
    await waitFor(() =>
      expect(
        apiFetchMock.mock.calls.some(([p, init]) => p === "/api/crm/proposals/601/" && init?.method === "PATCH"),
      ).toBe(true),
    );
    const call = apiFetchMock.mock.calls.find(([p, init]) => p === "/api/crm/proposals/601/" && init?.method === "PATCH")!;
    expect(call[1].body).toEqual({ status: "sent" });
  });

  it("crea una nueva versión de propuesta", async () => {
    mockApi();
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Nueva versión" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva versión de la propuesta" });
    const amount = within(dialog).getByLabelText("Importe (€)");
    expect(amount).toHaveValue(8000);
    await userEvent.clear(amount);
    await userEvent.type(amount, "7000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(posts(/proposals\/$/)).toHaveLength(1));
    expect(posts(/proposals\/$/)[0][1].body).toMatchObject({ amount: "7000", status: "draft", duration_months: 12 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("edita el contrato, incluida la fecha de renovación", async () => {
    mockApi(buildCrmOpportunity({ contract: buildCrmContract() }));
    await renderPage();
    const renewal = await screen.findByLabelText("Fecha de renovación");
    expect(renewal).toHaveValue("2027-07-01");
    await userEvent.clear(renewal);
    await userEvent.type(renewal, "2027-08-15");
    const section = renewal.closest("form") as HTMLElement;
    await userEvent.click(within(section).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(
        apiFetchMock.mock.calls.some(([p, init]) => p === "/api/crm/contracts/900/" && init?.method === "PATCH"),
      ).toBe(true),
    );
    const call = apiFetchMock.mock.calls.find(([p, init]) => p === "/api/crm/contracts/900/" && init?.method === "PATCH")!;
    expect(call[1].body).toMatchObject({ renewal_date: "2027-08-15", final_amount: "7200.00" });
  });

  it("solo dirección comercial puede eliminar, con confirmación de borrado lógico", async () => {
    mockApi();
    const { unmount } = await renderPage("sales");
    await screen.findByRole("heading", { name: "Popyplan Asociaciones", level: 1 });
    expect(screen.queryByRole("button", { name: "Eliminar oportunidad" })).not.toBeInTheDocument();
    unmount();

    mockApi();
    await renderPage("sales_lead");
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar oportunidad" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/borrado lógico/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/plataforma/comercial/oportunidades"));
    expect(
      apiFetchMock.mock.calls.some(([p, init]) => p === "/api/crm/opportunities/30/" && init?.method === "DELETE"),
    ).toBe(true);
  });
});
