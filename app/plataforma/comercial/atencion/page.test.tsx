import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});
const openActivityMock = vi.hoisted(() => vi.fn());
vi.mock("@/components/crm/CrmShell", () => ({
  useCrmContext: () => ({ isManager: false, userId: 0, openActivity: openActivityMock }),
}));

import { axe } from "@/test-utils/axe";
import { buildCrmAttention } from "@/test-utils/fixtures/crm-c";
import { crmApiRouter, requestedPaths } from "@/test-utils/fixtures/crm-c";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { render, screen, within } from "@/test-utils/render";

import PlataformaComercialAtencionPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
  openActivityMock.mockReset();
});

function session(role: string | null) {
  return { token: "t", me: buildMe({ org_memberships: [] }), platformRole: buildPlatformRole(role as never) };
}

async function renderPage(role = "sales_lead", attention?: unknown) {
  apiFetchMock.mockImplementation(crmApiRouter({ attention }));
  getServerSessionMock.mockResolvedValue(session(role));
  return render(await PlataformaComercialAtencionPage());
}

describe("Necesitan atención", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await renderPage();
    await screen.findByRole("table", { name: /^Entidades que necesitan atención/ });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("explica los umbrales de aviso", async () => {
    await renderPage();
    expect(await screen.findByText(/Los niveles de aviso son 7, 15, 30 y 60 días sin contacto/)).toBeInTheDocument();
    expect(screen.getByText("3 entidades necesitan atención")).toBeInTheDocument();
  });

  it("pinta cada entidad con su comercial, fase, días sin contacto, nivel con texto, importe y tarea", async () => {
    await renderPage();
    const table = await screen.findByRole("table", { name: /^Entidades que necesitan atención/ });
    const donostia = within(table).getByRole("row", { name: /Ayuntamiento de Donostia/ });
    expect(within(donostia).getByRole("link", { name: "Ayuntamiento de Donostia" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/entidades/1",
    );
    expect(donostia).toHaveTextContent("Mikel Errasti");
    expect(donostia).toHaveTextContent("Interesado");
    expect(donostia).toHaveTextContent("35 días");
    expect(donostia).toHaveTextContent("30+ días");
    expect(donostia).toHaveTextContent(/8000/);
    expect(donostia).toHaveTextContent("Enviar dossier y propuesta ·");
    const irun = within(table).getByRole("row", { name: /Ayuntamiento de Irun/ });
    expect(irun).toHaveTextContent("7+ días");
    expect(irun).toHaveTextContent("Carlos Pérez");
    const alava = within(table).getByRole("row", { name: /Diputación de Álava/ });
    expect(alava).toHaveTextContent("60+ días");
    expect(alava).toHaveTextContent("Nunca");
  });

  it("«Registrar actividad» abre el registro rápido con esa entidad", async () => {
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Registrar actividad: Ayuntamiento de Irun" }));
    expect(openActivityMock).toHaveBeenCalledWith({ account: { id: 2, name: "Ayuntamiento de Irun" } });
  });

  it("filtra por comercial (dirección) y por provincia, volviendo a la primera página", async () => {
    await renderPage();
    await screen.findByRole("table", { name: /^Entidades que necesitan atención/ });
    await userEvent.selectOptions(await screen.findByLabelText("Comercial"), "43");
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/attention/?owner=43");
    await userEvent.selectOptions(screen.getByLabelText("Provincia"), "Gipuzkoa");
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/attention/?owner=43&province=Gipuzkoa");
  });

  it("un comercial no ve el filtro por comercial", async () => {
    await renderPage("sales");
    await screen.findByRole("table", { name: /^Entidades que necesitan atención/ });
    expect(screen.queryByLabelText("Comercial")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Provincia")).toBeInTheDocument();
  });

  it("pagina con anterior y siguiente", async () => {
    await renderPage("sales_lead", buildCrmAttention({ next: "/api/crm/attention/?page=2", count: 90 }));
    const next = await screen.findByRole("button", { name: "Siguiente" });
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await userEvent.click(next);
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/attention/?page=2");
    expect(await screen.findByText("Página 2")).toBeInTheDocument();
  });

  it("sin entidades que atender lo dice", async () => {
    await renderPage("sales", buildCrmAttention({ count: 0, results: [] }));
    expect(await screen.findByText("Ninguna entidad necesita atención ahora mismo.")).toBeInTheDocument();
  });
});
