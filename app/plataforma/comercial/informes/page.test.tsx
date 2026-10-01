import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});
const downloadMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useCrm", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCrm")>("@/hooks/useCrm");
  return { ...actual, downloadCrmExport: downloadMock };
});

import { axe } from "@/test-utils/axe";
import { buildCrmReport, buildCrmSalespersonRow } from "@/test-utils/fixtures/crm";
import { crmApiRouter, requestedPaths } from "@/test-utils/fixtures/crm-c";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { render, screen, within } from "@/test-utils/render";

import PlataformaComercialInformesPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
  downloadMock.mockReset();
});

function session(role: string | null) {
  return { token: "t", me: buildMe({ org_memberships: [] }), platformRole: buildPlatformRole(role as never) };
}

async function renderPage(role = "sales_lead", report?: unknown) {
  apiFetchMock.mockImplementation(crmApiRouter({ report }));
  getServerSessionMock.mockResolvedValue(session(role));
  return render(await PlataformaComercialInformesPage());
}

describe("Informes del CRM", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await renderPage();
    await screen.findByRole("table", { name: /^Actividad y resultados por comercial/ });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("pide el informe con el periodo y cambia al pulsar otro", async () => {
    await renderPage();
    await screen.findByText("Resumen de actividad");
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/reports/?period=month");
    await userEvent.click(screen.getByRole("button", { name: "Este año" }));
    expect(await screen.findByText("Resumen de actividad")).toBeInTheDocument();
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/reports/?period=year");
  });

  it("resume la actividad, los días entre contactos y lo contratado", async () => {
    await renderPage();
    const dl = async (label: string) => (await screen.findByText(label, { selector: "dt" })).closest("dl");
    expect(await dl("Contactos realizados")).toHaveTextContent("30");
    expect(await dl("Días medios entre contactos")).toHaveTextContent("9,5");
    expect(await dl("Entidades sin seguimiento")).toHaveTextContent("7");
    expect(await dl("Importe contratado")).toHaveTextContent(/7200/);
    const byKind = screen.getByRole("table", { name: "Actividades del periodo por tipo" });
    expect(within(byKind).getByRole("row", { name: /Visita/ })).toHaveTextContent("32");
  });

  it("pinta el embudo con fases alcanzadas y conversión", async () => {
    await renderPage();
    const funnel = await screen.findByRole("table", { name: /^Embudo: oportunidades por fase/ });
    expect(within(funnel).getByRole("columnheader", { name: "Han llegado" })).toBeInTheDocument();
    const row = within(funnel).getByRole("row", { name: /Propuesta enviada/ });
    expect(row).toHaveTextContent("57,1 %");
    expect(row).toHaveTextContent("12 días");
  });

  it("actividad por comercial: todas las columnas juntas, alfabético y sin ranking", async () => {
    const report = buildCrmReport({
      by_salesperson: [
        buildCrmSalespersonRow({ user: 43, name: "Zoe Ruiz", visits: 90 }),
        buildCrmSalespersonRow({ user: 42, name: "Ana Mendi", visits: 3, win_rate: null }),
      ],
    });
    await renderPage("sales_lead", report);
    const table = await screen.findByRole("table", { name: /^Actividad y resultados por comercial/ });
    for (const header of ["Entidades", "Contactos", "Visitas", "Reuniones", "Llamadas", "Demos", "Propuestas", "Oportunidades abiertas", "Valor del pipeline", "Contratos", "Importe contratado", "Tareas pendientes", "Tareas vencidas", "Tasa de éxito"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Ana Mendi");
    expect(rows[1]).toHaveTextContent("Zoe Ruiz");
    expect(rows[1]).toHaveTextContent("90");
    expect(rows[0]).toHaveTextContent(/48\.000/);
    expect(screen.getByText(/No es un ranking/)).toBeInTheDocument();
    expect(screen.queryByText(/medalla/i)).not.toBeInTheDocument();
  });

  it("lista los motivos de pérdida con su etiqueta", async () => {
    await renderPage();
    const table = await screen.findByRole("table", { name: "Oportunidades perdidas por motivo" });
    expect(within(table).getByRole("row", { name: /Sin presupuesto/ })).toHaveTextContent("2");
  });

  it("sin pérdidas lo dice", async () => {
    await renderPage("sales_lead", buildCrmReport({ lost_reasons: [] }));
    expect(await screen.findByText("No hay oportunidades perdidas en este periodo.")).toBeInTheDocument();
  });

  it("exporta entidades, oportunidades y actividades con los filtros", async () => {
    downloadMock.mockResolvedValue(undefined);
    await renderPage();
    await screen.findByText("Resumen de actividad");
    await userEvent.selectOptions(await screen.findByLabelText("Comercial"), "43");
    await userEvent.click(screen.getByRole("button", { name: "Exportar entidades (CSV)" }));
    await userEvent.click(screen.getByRole("button", { name: "Exportar oportunidades (CSV)" }));
    await userEvent.click(screen.getByRole("button", { name: "Exportar actividades (CSV)" }));
    expect(downloadMock.mock.calls.map((call) => call[0])).toEqual(["accounts", "opportunities", "activities"]);
    expect(downloadMock.mock.calls[0][1]).toMatchObject({ owner: 43 });
  });

  it("la exportación lleva el mismo periodo que el informe en pantalla", async () => {
    downloadMock.mockResolvedValue(undefined);
    await renderPage();
    await screen.findByText("Resumen de actividad");
    await userEvent.click(screen.getByRole("button", { name: "Exportar actividades (CSV)" }));
    expect(downloadMock.mock.calls[0][1]).toMatchObject({ period: "month" });
  });

  it("si la exportación falla avisa", async () => {
    downloadMock.mockRejectedValue(new Error("x"));
    await renderPage();
    await screen.findByText("Resumen de actividad");
    await userEvent.click(screen.getByRole("button", { name: "Exportar entidades (CSV)" }));
    expect(await screen.findByText("No se pudo exportar. Inténtalo de nuevo.")).toBeInTheDocument();
  });
});
