import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});
const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { fireEvent, render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { CRM_USER, CRM_USER_2 } from "@/test-utils/fixtures/crm";
import { CRM_PRODUCTS, buildCrmPipelineAccounts, buildCrmPipelineOpportunities } from "@/test-utils/fixtures/crm-b";

import PlataformaComercialPipelinePage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

function mockApi() {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (path.startsWith("/api/crm/pipeline/")) {
      return path.includes("of=accounts") ? buildCrmPipelineAccounts() : buildCrmPipelineOpportunities();
    }
    if (path.startsWith("/api/crm/catalog/")) return CRM_PRODUCTS;
    if (path === "/api/crm/users/") return [CRM_USER, CRM_USER_2];
    if (/\/api\/crm\/opportunities\/\d+\/(move|win)\/$/.test(path) && init?.method === "POST") return {};
    if (/\/api\/crm\/accounts\/\d+\/$/.test(path) && init?.method === "PATCH") return {};
    throw new Error(`sin mock para ${path}`);
  });
}

async function renderPage(role = "sales") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole(role as never),
  });
  return render(await PlataformaComercialPipelinePage());
}

const calls = (needle: RegExp) =>
  apiFetchMock.mock.calls.filter(([path, init]) => needle.test(path) && init?.method === "POST");

describe("PlataformaComercialPipelinePage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockApi();
    const { container } = await renderPage();
    await screen.findByRole("heading", { name: "Interesado" });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("pinta una columna por fase con su recuento e importe y las tarjetas", async () => {
    mockApi();
    await renderPage();
    const column = (await screen.findByRole("heading", { name: "Interesado" })).closest("section") as HTMLElement;
    expect(within(column).getByText(/^1 elemento · 3000\s€$/)).toBeInTheDocument();
    expect(within(column).getByRole("link", { name: "Popyplan Cultura" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/oportunidades/31",
    );
    expect(within(column).getByRole("link", { name: "Ayuntamiento de Irun" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/entidades/2",
    );
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(4);
    expect(screen.queryByLabelText("Responsable")).not.toBeInTheDocument();
  });

  it("dirección comercial puede filtrar por responsable", async () => {
    mockApi();
    await renderPage("sales_lead");
    const select = await screen.findByLabelText("Responsable");
    await screen.findByRole("option", { name: "Carlos Pérez" });
    await userEvent.selectOptions(select, "43");
    await waitFor(() =>
      expect(apiFetchMock.mock.calls.some(([p]) => String(p).includes("owner=43"))).toBe(true),
    );
  });

  it("mueve una oportunidad con «Mover a…» llamando a /move/ con la fase", async () => {
    mockApi();
    await renderPage();
    const select = await screen.findByLabelText("Mover «Popyplan Cultura» a otra fase");
    await userEvent.selectOptions(select, "Propuesta enviada");
    await waitFor(() => expect(calls(/\/opportunities\/31\/move\/$/)).toHaveLength(1));
    expect(calls(/\/opportunities\/31\/move\/$/)[0][1].body).toEqual({ stage: 6 });
    expect(await screen.findByText("«Popyplan Cultura» pasa a «Propuesta enviada».")).toBeInTheDocument();
  });

  it("arrastrar una tarjeta a otra columna también la mueve", async () => {
    mockApi();
    await renderPage();
    const card = (await screen.findByRole("link", { name: "Popyplan Cultura" })).closest("li") as HTMLElement;
    const target = screen.getByRole("heading", { name: "Propuesta enviada" }).closest("section") as HTMLElement;
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    await waitFor(() => expect(calls(/\/opportunities\/31\/move\/$/)).toHaveLength(1));
    expect(calls(/\/opportunities\/31\/move\/$/)[0][1].body).toEqual({ stage: 6 });
  });

  it("perder exige un motivo antes de mover", async () => {
    mockApi();
    await renderPage();
    const select = await screen.findByLabelText("Mover «Popyplan Cultura» a otra fase");
    await userEvent.selectOptions(select, "Perdido");
    const dialog = await screen.findByRole("dialog", { name: "Perder «Popyplan Cultura»" });
    expect(calls(/move\/$/)).toHaveLength(0);
    const confirm = within(dialog).getByRole("button", { name: "Marcar como perdida" });
    expect(confirm).toBeDisabled();
    await userEvent.selectOptions(within(dialog).getByLabelText("Motivo"), "price");
    await userEvent.type(within(dialog).getByLabelText("Detalle (opcional)"), "Sin presupuesto");
    await userEvent.click(confirm);
    await waitFor(() => expect(calls(/\/opportunities\/31\/move\/$/)).toHaveLength(1));
    expect(calls(/move\/$/)[0][1].body).toEqual({
      stage: 11,
      lost_reason: "price",
      lost_detail: "Sin presupuesto",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("ganar abre el diálogo de contrato y envía /win/", async () => {
    mockApi();
    await renderPage();
    const select = await screen.findByLabelText("Mover «Popyplan Asociaciones» a otra fase");
    await userEvent.selectOptions(select, "Ganado");
    const dialog = await screen.findByRole("dialog", { name: "Registrar contrato de «Popyplan Asociaciones»" });
    expect(calls(/win\/$/)).toHaveLength(0);
    const amount = within(dialog).getByLabelText("Importe final (€)");
    expect(amount).toHaveValue(8000);
    await userEvent.clear(amount);
    await userEvent.type(amount, "7200");
    await userEvent.type(within(dialog).getByLabelText("Nº de expediente"), "EXP-1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Registrar contrato" }));
    await waitFor(() => expect(calls(/\/opportunities\/30\/win\/$/)).toHaveLength(1));
    const body = calls(/win\/$/)[0][1].body;
    expect(body).toMatchObject({ final_amount: "7200", file_number: "EXP-1", renewal_date: null });
    expect(body.awarded_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("muestra el error del servidor y mantiene abierto el diálogo", async () => {
    mockApi();
    const { ApiError } = await import("@/lib/api/client");
    const base = apiFetchMock.getMockImplementation()!;
    apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (/move\/$/.test(path)) throw new ApiError(400, { detail: "Elige un motivo." } as never);
      return base(path, init);
    });
    await renderPage();
    await userEvent.selectOptions(await screen.findByLabelText("Mover «Popyplan Cultura» a otra fase"), "Perdido");
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Motivo"), "price");
    await userEvent.click(within(dialog).getByRole("button", { name: "Marcar como perdida" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Elige un motivo.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("en modo Entidades pinta las entidades y cambia su fase con useUpdateAccount", async () => {
    mockApi();
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Entidades" }));
    expect(screen.getByRole("button", { name: "Entidades" })).toHaveAttribute("aria-pressed", "true");
    const link = await screen.findByRole("link", { name: "Ayuntamiento de Donostia" });
    expect(link).toHaveAttribute("href", "/plataforma/comercial/entidades/1");
    const select = screen.getByLabelText("Mover «Ayuntamiento de Donostia» a otra fase");
    await userEvent.selectOptions(select, "Propuesta enviada");
    await waitFor(() =>
      expect(
        apiFetchMock.mock.calls.some(([p, init]) => p === "/api/crm/accounts/1/" && init?.method === "PATCH"),
      ).toBe(true),
    );
    const call = apiFetchMock.mock.calls.find(([p, init]) => p === "/api/crm/accounts/1/" && init?.method === "PATCH")!;
    expect(call[1].body).toEqual({ stage: 6 });
  });

  it("redirige al login sin sesión", async () => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaComercialPipelinePage()).rejects.toBeInstanceOf(NextRedirectSignal);
  });
});
