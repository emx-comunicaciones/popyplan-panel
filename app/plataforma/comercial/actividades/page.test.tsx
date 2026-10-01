import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});
const exportMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useCrm", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCrm")>("@/hooks/useCrm");
  return { ...actual, downloadCrmExport: exportMock };
});

import { act, fireEvent, render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { buildCrmActivity, paginated } from "@/test-utils/fixtures/crm";
import { callsTo, crmSession, routeApi } from "@/test-utils/fixtures/crm-d";

import Page from "./page";

afterEach(() => {
  vi.useRealTimers();
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
  exportMock.mockReset();
});

const ACTIVITIES = [
  buildCrmActivity(),
  buildCrmActivity({ id: 101, kind: "call", title: "", summary: "Llamada para fijar la demo", has_follow_up: false, result: "neutral" }),
];

async function setup(role: "sales" | "sales_lead" = "sales_lead") {
  getServerSessionMock.mockResolvedValue(crmSession(role));
  routeApi(apiFetchMock, {
    "/api/crm/activities/": paginated(ACTIVITIES),
    "/api/crm/activities/100/": (_p: string, init?: { method?: string }) => (init?.method === "DELETE" ? undefined : ACTIVITIES[0]),
  });
  return render(await Page());
}

describe("Actividades del CRM", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await setup();
    await screen.findByText("Reunión con Servicios Sociales");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("lista las actividades con su entidad, resultado y seguimiento", async () => {
    await setup();
    const table = await screen.findByRole("table", { name: "Actividades registradas" });
    expect(within(table).getAllByRole("link", { name: "Ayuntamiento de Donostia" })[0]).toHaveAttribute(
      "href",
      "/plataforma/comercial/entidades/1",
    );
    expect(within(table).getByText("Con seguimiento")).toBeInTheDocument();
    expect(within(table).getByText("Sin seguimiento")).toBeInTheDocument();
    expect(within(table).getByText("Llamada para fijar la demo")).toBeInTheDocument();
  });

  it("los filtros cambian las peticiones (tipo, comercial, fechas y texto con retardo)", async () => {
    await setup();
    await screen.findByText("Reunión con Servicios Sociales");
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "meeting");
    await waitFor(() => expect(callsTo(apiFetchMock, "activity_kind=meeting")).not.toHaveLength(0));
    await userEvent.selectOptions(await screen.findByLabelText("Comercial"), "43");
    await waitFor(() => expect(callsTo(apiFetchMock, "activity_owner=43")).not.toHaveLength(0));
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-30" } });
    await waitFor(() => expect(callsTo(apiFetchMock, "since=2026-09-01&until=2026-09-30")).not.toHaveLength(0));

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "demo" } });
    const before = callsTo(apiFetchMock, "q=demo").length;
    expect(before).toBe(0);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();
    await waitFor(() => expect(callsTo(apiFetchMock, "q=demo")).not.toHaveLength(0));
  });

  it("un comercial no ve el filtro de comercial", async () => {
    await setup("sales");
    await screen.findByText("Reunión con Servicios Sociales");
    expect(screen.queryByLabelText("Comercial")).not.toBeInTheDocument();
  });

  it("edita una actividad y avisa de que queda en el historial", async () => {
    await setup();
    const rows = await screen.findAllByRole("button", { name: "Ver y editar" });
    await userEvent.click(rows[0]);
    const dialog = await screen.findByRole("dialog", { name: "Actividad" });
    expect(within(dialog).getByText(/actividad editada/)).toBeInTheDocument();
    const summary = within(dialog).getByLabelText("Resumen");
    await userEvent.clear(summary);
    await userEvent.type(summary, "Quieren piloto en otoño");
    await userEvent.selectOptions(within(dialog).getByLabelText("Resultado"), "very_positive");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [, init] = callsTo(apiFetchMock, "/api/crm/activities/100/", "PATCH")[0];
    expect(init.body).toMatchObject({ summary: "Quieren piloto en otoño", result: "very_positive" });
  });

  it("el error al guardar se queda en el diálogo", async () => {
    const { ApiError } = await import("@/lib/api/client");
    getServerSessionMock.mockResolvedValue(crmSession("sales_lead"));
    routeApi(apiFetchMock, {
      "/api/crm/activities/": paginated(ACTIVITIES),
      "/api/crm/activities/100/": () => {
        throw new ApiError(400, { detail: "Duración no válida." });
      },
    });
    render(await Page());
    const rows = await screen.findAllByRole("button", { name: "Ver y editar" });
    await userEvent.click(rows[0]);
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Duración no válida.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("borra con confirmación", async () => {
    await setup();
    const buttons = await screen.findAllByRole("button", { name: "Borrar" });
    await userEvent.click(buttons[0]);
    const dialog = screen.getByRole("alertdialog");
    expect(callsTo(apiFetchMock, "/api/crm/activities/100/", "DELETE")).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar actividad" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/activities/100/", "DELETE")).toHaveLength(1));
  });

  it("exporta a CSV con los filtros activos", async () => {
    await setup();
    await screen.findByText("Reunión con Servicios Sociales");
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "visit");
    await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(exportMock).toHaveBeenCalledWith("activities", expect.objectContaining({ activity_kind: "visit" }));
  });
});
