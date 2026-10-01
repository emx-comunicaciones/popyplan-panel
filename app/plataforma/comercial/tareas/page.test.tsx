import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { fireEvent, render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { buildCrmTask, paginated } from "@/test-utils/fixtures/crm";
import { CRM_TASK_COUNTS, callsTo, crmSession, routeApi } from "@/test-utils/fixtures/crm-d";

import Page from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const TASKS = [
  buildCrmTask(),
  buildCrmTask({ id: 201, title: "Llamar a Gobierno Abierto", priority: "urgent", is_overdue: true, status: "pending", kind: "call", account: null, account_name: "", contact_name: "", reminder_minutes: null }),
];

async function setup(role: "sales" | "sales_lead" = "sales") {
  getServerSessionMock.mockResolvedValue(crmSession(role));
  routeApi(apiFetchMock, {
    "/api/crm/tasks/": (_p: string, init?: { method?: string }) =>
      init?.method === "POST" ? TASKS[0] : paginated(TASKS),
    "/api/crm/tasks/counts/": CRM_TASK_COUNTS,
    "/api/crm/tasks/200/": TASKS[0],
    "/api/crm/tasks/201/": TASKS[1],
  });
  return render(await Page());
}

describe("Tareas del CRM", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await setup();
    await screen.findByText("Enviar dossier y propuesta");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("pinta los cubos con su contador, HOY por defecto, y cambia de cubo", async () => {
    await setup();
    await screen.findByText("Enviar dossier y propuesta");
    const today = await screen.findByRole("button", { name: "Hoy (3)" });
    expect(today).toHaveAttribute("aria-pressed", "true");
    expect(callsTo(apiFetchMock, "/api/crm/tasks/?bucket=today")).not.toHaveLength(0);
    const overdue = screen.getByRole("button", { name: "Atrasadas (1)" });
    expect(overdue).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(overdue);
    expect(overdue).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(callsTo(apiFetchMock, "bucket=overdue")).not.toHaveLength(0));
    expect(screen.getByRole("button", { name: "Próximas (5)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Completadas (12)" })).toBeInTheDocument();
  });

  it("marca con texto lo atrasado y lo urgente", async () => {
    await setup();
    const row = (await screen.findByText("Llamar a Gobierno Abierto")).closest("li") as HTMLElement;
    expect(within(row).getByText("Atrasada")).toBeInTheDocument();
    expect(within(row).getByText("Prioridad: Urgente")).toBeInTheDocument();
    expect(within(row).getByText(/sin recordatorio/)).toBeInTheDocument();
  });

  it("completa una tarea con un PATCH de estado", async () => {
    await setup();
    const row = (await screen.findByText("Enviar dossier y propuesta")).closest("li") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Completar" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/tasks/200/", "PATCH")).toHaveLength(1));
    expect(callsTo(apiFetchMock, "/api/crm/tasks/200/", "PATCH")[0][1].body).toEqual({ status: "done" });
  });

  it("pone en curso y cancela con confirmación", async () => {
    await setup();
    const row = (await screen.findByText("Enviar dossier y propuesta")).closest("li") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "En curso" }));
    await waitFor(() =>
      expect(callsTo(apiFetchMock, "/api/crm/tasks/200/", "PATCH")[0][1].body).toEqual({ status: "in_progress" }),
    );
    await userEvent.click(within(row).getByRole("button", { name: "Cancelar tarea" }));
    const dialog = screen.getByRole("alertdialog");
    expect(callsTo(apiFetchMock, "/api/crm/tasks/200/", "PATCH")).toHaveLength(1);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar tarea" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/tasks/200/", "PATCH")).toHaveLength(2));
    expect(callsTo(apiFetchMock, "/api/crm/tasks/200/", "PATCH")[1][1].body).toEqual({ status: "cancelled" });
  });

  it("crea una tarea con la fecha elegida", async () => {
    await setup();
    await screen.findByText("Enviar dossier y propuesta");
    await userEvent.click(screen.getByRole("button", { name: "+ Nueva tarea" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva tarea" });
    expect(within(dialog).queryByLabelText("Responsable")).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Qué hay que hacer"), "Preparar demo");
    fireEvent.change(within(dialog).getByLabelText("Fecha y hora"), { target: { value: "2026-10-20T11:30" } });
    await userEvent.selectOptions(within(dialog).getByLabelText("Prioridad"), "high");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [, init] = callsTo(apiFetchMock, "/api/crm/tasks/", "POST")[0];
    expect(init.body).toMatchObject({
      title: "Preparar demo",
      priority: "high",
      kind: "call",
      due_at: new Date("2026-10-20T11:30").toISOString(),
    });
  });

  it("edita una tarea", async () => {
    await setup();
    const row = (await screen.findByText("Enviar dossier y propuesta")).closest("li") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar tarea" });
    const title = within(dialog).getByLabelText("Qué hay que hacer");
    await userEvent.clear(title);
    await userEvent.type(title, "Enviar dossier hoy");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/tasks/200/", "PATCH")).toHaveLength(1));
    expect(callsTo(apiFetchMock, "/api/crm/tasks/200/", "PATCH")[0][1].body).toMatchObject({ title: "Enviar dossier hoy" });
  });

  it("dirección ve todo el equipo y filtra por responsable; un comercial no", async () => {
    await setup("sales_lead");
    await screen.findByText("Enviar dossier y propuesta");
    expect(callsTo(apiFetchMock, "mine=false")).toHaveLength(0);
    const team = screen.getByRole("button", { name: "Todo el equipo" });
    await userEvent.click(team);
    expect(team).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(callsTo(apiFetchMock, "mine=false")).not.toHaveLength(0));
    await userEvent.selectOptions(await screen.findByLabelText("Responsable"), "43");
    await waitFor(() => expect(callsTo(apiFetchMock, "assignee=43")).not.toHaveLength(0));
  });

  it("un comercial no ve «Todo el equipo»", async () => {
    await setup("sales");
    await screen.findByText("Enviar dossier y propuesta");
    expect(screen.queryByRole("button", { name: "Todo el equipo" })).not.toBeInTheDocument();
  });
});
