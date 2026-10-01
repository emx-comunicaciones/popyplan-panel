import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { ApiError } from "@/lib/api/client";
import { fireEvent, render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { CRM_STAGES } from "@/test-utils/fixtures/crm";
import {
  CRM_SETTINGS,
  buildCrmCatalogItem,
  buildCrmTag,
  callsTo,
  crmSession,
  routeApi,
} from "@/test-utils/fixtures/crm-d";

import Page from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const CATALOG = [buildCrmCatalogItem(), buildCrmCatalogItem({ id: 2, name: "Contacto directo", order: 1, is_active: false })];

async function setup(role: "sales" | "sales_lead" | "superadmin" = "sales_lead", extra: Record<string, unknown> = {}) {
  getServerSessionMock.mockResolvedValue(crmSession(role));
  routeApi(apiFetchMock, {
    "/api/crm/stages/": (_p: string, init?: { method?: string }) => (init?.method === "POST" ? CRM_STAGES[0] : CRM_STAGES),
    "/api/crm/stages/8/": CRM_STAGES[4],
    "/api/crm/catalog/": (_p: string, init?: { method?: string }) => (init?.method === "POST" ? CATALOG[0] : CATALOG),
    "/api/crm/catalog/1/": CATALOG[0],
    "/api/crm/catalog/2/": CATALOG[1],
    "/api/crm/tags/": (_p: string, init?: { method?: string }) => (init?.method === "POST" ? buildCrmTag() : [buildCrmTag()]),
    "/api/crm/settings/": (_p: string, init?: { method?: string; body?: unknown }) => (init?.method === "PUT" ? init.body : CRM_SETTINGS),
    ...extra,
  });
  return render(await Page());
}

const stageRow = async (name: string) => (await screen.findByText(name)).closest("tr") as HTMLElement;

describe("Configuración del CRM", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await setup();
    await screen.findByText("Negociación");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("un comercial ve el aviso de que no tiene acceso", async () => {
    await setup("sales");
    expect(screen.getByText(/Solo dirección comercial y administración/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fases del pipeline" })).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("lista las fases con tipo, probabilidad y estado y avisa de perdido/ganado", async () => {
    await setup();
    const row = await stageRow("Negociación");
    expect(within(row).getByText("Abierta")).toBeInTheDocument();
    expect(within(row).getByText("70 %")).toBeInTheDocument();
    expect(within(row).getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText(/«Perdido» exige indicar el motivo/)).toBeInTheDocument();
    expect(screen.getByText(/no se borran: se desactivan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fases del pipeline" })).toHaveAttribute("aria-pressed", "true");
  });

  it("edita una fase en línea y guarda con PATCH", async () => {
    await setup();
    const row = await stageRow("Negociación");
    await userEvent.click(within(row).getByRole("button", { name: "Editar" }));
    const name = screen.getByLabelText("Nombre de la fase Negociación");
    await userEvent.clear(name);
    await userEvent.type(name, "Negociación final");
    fireEvent.change(screen.getByLabelText("Probabilidad de la fase Negociación"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("Color de la fase Negociación"), { target: { value: "#112233" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/stages/8/", "PATCH")).toHaveLength(1));
    expect(callsTo(apiFetchMock, "/api/crm/stages/8/", "PATCH")[0][1].body).toMatchObject({
      name: "Negociación final",
      probability: 80,
      color: "#112233",
    });
  });

  it("desactiva una fase sin borrarla", async () => {
    await setup();
    const row = await stageRow("Negociación");
    await userEvent.click(within(row).getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/stages/8/", "PATCH")).toHaveLength(1));
    expect(callsTo(apiFetchMock, "/api/crm/stages/8/", "PATCH")[0][1].body).toEqual({ is_active: false });
    expect(callsTo(apiFetchMock, "/api/crm/stages/", "DELETE")).toHaveLength(0);
  });

  it("crea una fase nueva validando la clave", async () => {
    await setup();
    await screen.findByText("Negociación");
    await userEvent.click(screen.getByRole("button", { name: "+ Nueva fase" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva fase" });
    const save = within(dialog).getByRole("button", { name: "Crear fase" });
    await userEvent.type(within(dialog).getByLabelText("Clave"), "Reunión agendada");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Reunión agendada");
    expect(save).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText("Clave"));
    await userEvent.type(within(dialog).getByLabelText("Clave"), "reunion_agendada");
    await userEvent.selectOptions(within(dialog).getByLabelText("Tipo"), "paused");
    fireEvent.change(within(dialog).getByLabelText("Orden"), { target: { value: "3" } });
    await userEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(callsTo(apiFetchMock, "/api/crm/stages/", "POST")[0][1].body).toMatchObject({
      key: "reunion_agendada",
      name: "Reunión agendada",
      kind: "paused",
      order: 3,
    });
  });

  it("el error de una fase nueva se queda en el diálogo", async () => {
    await setup("sales_lead", {
      "/api/crm/stages/": (_p: string, init?: { method?: string }) => {
        if (init?.method === "POST") throw new ApiError(400, { detail: "Ya existe una fase con esa clave." });
        return CRM_STAGES;
      },
    });
    await screen.findByText("Negociación");
    await userEvent.click(screen.getByRole("button", { name: "+ Nueva fase" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva fase" });
    await userEvent.type(within(dialog).getByLabelText("Clave"), "ganado");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Ganado 2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear fase" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ya existe una fase con esa clave.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("listas: añade un elemento, renombra y activa", async () => {
    await setup();
    await userEvent.click(await screen.findByRole("button", { name: "Listas" }));
    const sources = await screen.findByRole("button", { name: "Origen del contacto" });
    expect(sources).toHaveAttribute("aria-pressed", "true");
    await screen.findByText("Jornada FEMP");
    expect(callsTo(apiFetchMock, "kind=source")).not.toHaveLength(0);

    await userEvent.type(screen.getByLabelText("Nuevo elemento"), "Feria Smart City");
    await userEvent.click(screen.getByRole("button", { name: "Añadir" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/catalog/", "POST")).toHaveLength(1));
    expect(callsTo(apiFetchMock, "/api/crm/catalog/", "POST")[0][1].body).toEqual({ kind: "source", name: "Feria Smart City" });

    const row = (await screen.findByText("Jornada FEMP")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Editar" }));
    const name = screen.getByLabelText("Nombre de Jornada FEMP");
    await userEvent.clear(name);
    await userEvent.type(name, "Jornada FEMP 2026");
    fireEvent.change(screen.getByLabelText("Orden de Jornada FEMP"), { target: { value: "5" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/catalog/1/", "PATCH")).toHaveLength(1));
    expect(callsTo(apiFetchMock, "/api/crm/catalog/1/", "PATCH")[0][1].body).toEqual({ name: "Jornada FEMP 2026", order: 5 });

    const inactive = (await screen.findByText("Contacto directo")).closest("tr") as HTMLElement;
    await userEvent.click(within(inactive).getByRole("button", { name: "Activar" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/catalog/2/", "PATCH")).toHaveLength(1));
    expect(callsTo(apiFetchMock, "/api/crm/catalog/2/", "PATCH")[0][1].body).toEqual({ is_active: true });

    await userEvent.click(screen.getByRole("button", { name: "Producto" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "kind=product")).not.toHaveLength(0));
  });

  it("etiquetas: lista y crea", async () => {
    await setup();
    await userEvent.click(await screen.findByRole("button", { name: "Etiquetas" }));
    const list = await screen.findByRole("list", { name: "Etiquetas existentes" });
    expect(within(list).getByText("Adicciones")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nueva etiqueta"), "Mayores");
    await userEvent.click(screen.getByRole("button", { name: "Crear etiqueta" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/tags/", "POST")).toHaveLength(1));
    expect(callsTo(apiFetchMock, "/api/crm/tags/", "POST")[0][1].body).toMatchObject({ name: "Mayores" });
  });

  it("umbrales: guarda con PUT enteros y listas", async () => {
    await setup();
    await userEvent.click(await screen.findByRole("button", { name: "Umbrales" }));
    const attention = await screen.findByLabelText(/Días sin contacto/);
    expect(attention).toHaveValue("15, 30, 60");
    await userEvent.clear(attention);
    await userEvent.type(attention, "10, 20,45");
    fireEvent.change(screen.getByLabelText("Días sin actividad en una oportunidad"), { target: { value: "28" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/settings/", "PUT")).toHaveLength(1));
    expect(callsTo(apiFetchMock, "/api/crm/settings/", "PUT")[0][1].body).toEqual({
      attention_days: [10, 20, 45],
      opportunity_idle_days: 28,
      proposal_followup_days: 10,
      close_date_warning_days: 14,
      renewal_alert_days: [90, 60, 30],
    });
    expect(await screen.findByText("Umbrales guardados.")).toBeInTheDocument();
  });

  it("umbrales: valida enteros en el cliente y enseña el error de campo del backend", async () => {
    await setup();
    await userEvent.click(await screen.findByRole("button", { name: "Umbrales" }));
    const attention = await screen.findByLabelText(/Días sin contacto/);
    await userEvent.clear(attention);
    await userEvent.type(attention, "diez, 20");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Escribe números enteros positivos separados por comas.")).toBeInTheDocument();
    expect(callsTo(apiFetchMock, "/api/crm/settings/", "PUT")).toHaveLength(0);

    apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === "PUT") throw new ApiError(400, { renewal_alert_days: ["Deben ir de mayor a menor."] });
      if (path.startsWith("/api/crm/settings/")) return CRM_SETTINGS;
      return [];
    });
    await userEvent.clear(attention);
    await userEvent.type(attention, "15, 30");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Deben ir de mayor a menor.")).toBeInTheDocument();
  });
});
