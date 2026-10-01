import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { axe } from "@/test-utils/axe";
import { buildCrmDashboard } from "@/test-utils/fixtures/crm";
import { crmApiRouter, requestedPaths } from "@/test-utils/fixtures/crm-c";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { render, screen, within } from "@/test-utils/render";

import PlataformaComercialPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

function session(role: string | null) {
  return { token: "t", me: buildMe({ org_memberships: [] }), platformRole: buildPlatformRole(role as never) };
}

async function renderPage(role = "sales") {
  apiFetchMock.mockImplementation(crmApiRouter());
  getServerSessionMock.mockResolvedValue(session(role));
  return render(await PlataformaComercialPage());
}

const card = (label: string) => screen.getByText(label, { selector: "dt" }).closest("dl") as HTMLElement;

describe("Dashboard comercial", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await renderPage();
    await screen.findByText("Entidades totales");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("pinta los KPI del periodo y de la cartera", async () => {
    await renderPage();
    expect(await screen.findByText("Entidades totales")).toBeInTheDocument();
    expect(card("Entidades totales")).toHaveTextContent("88");
    expect(card("Sin contactar")).toHaveTextContent("54");
    expect(card("Contactos realizados")).toHaveTextContent("30");
    expect(card("Visitas")).toHaveTextContent("32");
    expect(card("Propuestas enviadas")).toHaveTextContent("2");
    expect(card("Oportunidades abiertas")).toHaveTextContent("12");
    expect(card("Tareas vencidas")).toHaveTextContent("2");
    expect(card("Sin seguimiento")).toHaveTextContent("7");
    for (const label of ["Entidades nuevas", "Contactadas", "Reuniones", "Videollamadas", "Llamadas", "Demos", "Pilotos", "Contrataciones", "Perdidas", "Tareas pendientes"]) {
      expect(card(label)).toBeInTheDocument();
    }
  });

  it("pinta la economía con importes en euros", async () => {
    await renderPage();
    expect(await screen.findByText("Valor total del pipeline")).toBeInTheDocument();
    expect(card("Valor total del pipeline")).toHaveTextContent(/96\.000/);
    expect(card("Valor ponderado")).toHaveTextContent(/31\.000/);
    expect(card("Importe de propuestas enviadas")).toHaveTextContent(/15\.500/);
    expect(card("Importe contratado")).toHaveTextContent(/7200/);
    expect(card("Ticket medio")).toHaveTextContent(/7200/);
  });

  it("muestra la variación solo cuando no es nula", async () => {
    await renderPage();
    await screen.findByText("Entidades totales");
    expect(card("Visitas")).toHaveTextContent("+14,3 % respecto al periodo anterior");
    expect(card("Llamadas")).toHaveTextContent("0 % respecto al periodo anterior");
    expect(card("Contrataciones")).not.toHaveTextContent("respecto al periodo anterior");
    expect(card("Entidades totales")).not.toHaveTextContent("respecto al periodo anterior");
  });

  it("la flecha es decorativa y la bajada también lleva signo", async () => {
    apiFetchMock.mockImplementation(crmApiRouter({ dashboard: buildCrmDashboard({ change: { visits: -8 } }) }));
    getServerSessionMock.mockResolvedValue(session("sales"));
    render(await PlataformaComercialPage());
    await screen.findByText("Entidades totales");
    const visits = card("Visitas");
    expect(visits).toHaveTextContent("-8 % respecto al periodo anterior");
    expect(visits.querySelector("[aria-hidden='true']")).toHaveTextContent("▼");
  });

  it("los botones de periodo piden el dashboard con ese periodo", async () => {
    await renderPage();
    await screen.findByText("Entidades totales");
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/dashboard/?period=month");
    expect(screen.getByRole("button", { name: "Este mes" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Esta semana" }));

    expect(await screen.findByText("Entidades totales")).toBeInTheDocument();
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/dashboard/?period=week");
    expect(screen.getByRole("button", { name: "Esta semana" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Este mes" })).toHaveAttribute("aria-pressed", "false");
    for (const name of ["Hoy", "Este trimestre", "Este año", "Personalizado"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("el periodo personalizado pide con las fechas y avisa si el rango es inválido", async () => {
    await renderPage();
    await screen.findByText("Entidades totales");
    await userEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    const since = screen.getByLabelText("Desde");
    const until = screen.getByLabelText("Hasta");

    await userEvent.clear(since);
    await userEvent.type(since, "2026-02-01");
    await userEvent.clear(until);
    await userEvent.type(until, "2026-03-31");

    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/dashboard/?period=custom&since=2026-02-01&until=2026-03-31");

    await userEvent.clear(until);
    await userEvent.type(until, "2026-01-01");
    expect(await screen.findByRole("alert")).toHaveTextContent("Las fechas no son válidas");
    expect(requestedPaths(apiFetchMock)).not.toContain("/api/crm/dashboard/?period=custom&since=2026-02-01&until=2026-01-01");
  });

  it("pinta el embudo en una tabla con conversión y días medios, y las perdidas aparte", async () => {
    await renderPage();
    const funnel = await screen.findByRole("table", { name: /^Embudo: oportunidades por fase/ });
    const row = within(funnel).getByRole("row", { name: /Interesado/ });
    expect(row).toHaveTextContent("4");
    expect(row).toHaveTextContent(/16\.000/);
    expect(row).toHaveTextContent("58,3 %");
    expect(row).toHaveTextContent("9 días");
    expect(within(funnel).getByRole("row", { name: /Ganado/ })).toBeInTheDocument();
    expect(within(funnel).queryByRole("row", { name: /Perdido/ })).not.toBeInTheDocument();
    const aside = screen.getByRole("table", { name: "Oportunidades perdidas y en pausa" });
    expect(within(aside).getByRole("row", { name: /Perdido/ })).toBeInTheDocument();
    expect(within(aside).getByRole("row", { name: /Pausado/ })).toBeInTheDocument();
  });

  it("enlaza a «Necesitan atención» y a las tareas vencidas", async () => {
    await renderPage();
    expect(await screen.findByRole("link", { name: "Necesitan atención (7)" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/atencion",
    );
    expect(screen.getByRole("link", { name: "Ver tareas vencidas (2)" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/tareas",
    );
  });

  it("dirección comercial filtra por comercial y comunidad; un comercial no ve el de comercial", async () => {
    await renderPage("sales_lead");
    await screen.findByText("Entidades totales");
    await userEvent.selectOptions(await screen.findByLabelText("Comercial"), "43");
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/dashboard/?period=month&owner=43");
    await userEvent.selectOptions(await screen.findByLabelText("Comunidad autónoma"), "País Vasco");
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/dashboard/?period=month&owner=43&region=Pa%C3%ADs+Vasco");
  });

  it("un comercial no ve el filtro por comercial", async () => {
    await renderPage("sales");
    await screen.findByText("Entidades totales");
    expect(screen.queryByLabelText("Comercial")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Provincia")).toBeInTheDocument();
  });

  it("si falla la carga avisa en vez de pintar ceros", async () => {
    apiFetchMock.mockRejectedValue(new Error("boom"));
    getServerSessionMock.mockResolvedValue(session("sales"));
    render(await PlataformaComercialPage());
    expect(await screen.findByText(/^No disponible: no se pudieron cargar las cifras/)).toBeInTheDocument();
    expect(screen.queryByText("Entidades totales")).not.toBeInTheDocument();
  });
});
