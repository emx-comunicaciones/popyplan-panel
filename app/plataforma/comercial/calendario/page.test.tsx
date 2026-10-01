import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { buildCrmCalendarItem } from "@/test-utils/fixtures/crm";
import { callsTo, crmSession, routeApi } from "@/test-utils/fixtures/crm-d";

import Page from "./page";

afterEach(() => {
  vi.useRealTimers();
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const ITEMS = [
  buildCrmCalendarItem(),
  buildCrmCalendarItem({ type: "task", id: 200, kind: "email", title: "Enviar dossier", start: "2026-10-01T09:00:00", done: true }),
  buildCrmCalendarItem({ type: "renewal", id: 9, kind: "contract", title: "Contrato Popyplan Asociaciones", start: "2026-10-15T00:00:00", account: 2, account_name: "Diputación de Gipuzkoa" }),
];

async function setup(role: "sales" | "sales_lead" = "sales_lead") {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T10:00:00"));
  getServerSessionMock.mockResolvedValue(crmSession(role));
  routeApi(apiFetchMock, { "/api/crm/calendar/": ITEMS });
  return render(await Page());
}

const lastCalendarUrl = () => String(callsTo(apiFetchMock, "/api/crm/calendar/").at(-1)?.[0]);

describe("Calendario del CRM", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await setup();
    await screen.findAllByText("Visita a Servicios Sociales");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("el mes pide la cuadrícula completa con lunes primero y navega por meses", async () => {
    await setup();
    await screen.findAllByText("Visita a Servicios Sociales");
    expect(screen.getByRole("button", { name: "Mes" })).toHaveAttribute("aria-pressed", "true");
    expect(lastCalendarUrl()).toContain("since=2026-09-28&until=2026-11-01");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(lastCalendarUrl()).toContain("since=2026-10-26&until=2026-12-06"));
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => expect(lastCalendarUrl()).toContain("since=2026-08-31&until=2026-10-04"));
    await userEvent.click(screen.getByRole("button", { name: "Hoy" }));
    await waitFor(() => expect(lastCalendarUrl()).toContain("since=2026-09-28&until=2026-11-01"));
  });

  it("la semana y el día cambian since y until", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "Semana" }));
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(lastCalendarUrl()).toContain("since=2026-09-28&until=2026-10-04"));
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(lastCalendarUrl()).toContain("since=2026-10-05&until=2026-10-11"));
    await userEvent.click(screen.getByRole("button", { name: "Día" }));
    await waitFor(() => expect(lastCalendarUrl()).toContain("since=2026-10-08&until=2026-10-08"));
  });

  it("enseña actividades, tareas y renovaciones; lo hecho va tachado con texto y enlaza a la ficha", async () => {
    await setup();
    const [visit] = await screen.findAllByRole("link", { name: /Visita a Servicios Sociales/ });
    expect(visit).toHaveAttribute("href", "/plataforma/comercial/entidades/1");
    expect(visit.className).toContain("font-semibold");
    const [done] = screen.getAllByRole("link", { name: /Enviar dossier/ });
    expect(done.className).toContain("line-through");
    expect(done.parentElement).toHaveTextContent("completada");
    const [renewal] = screen.getAllByRole("link", { name: /Contrato Popyplan Asociaciones/ });
    expect(renewal).toHaveAttribute("href", "/plataforma/comercial/entidades/2");
    expect(renewal.parentElement).toHaveTextContent("Renovación");
  });

  it("filtra por comercial, provincia y tipo de actividad", async () => {
    await setup();
    await screen.findAllByText("Visita a Servicios Sociales");
    await userEvent.selectOptions(screen.getByLabelText("Tipo de actividad"), "visit");
    await waitFor(() => expect(lastCalendarUrl()).toContain("activity_kind=visit"));
    await userEvent.selectOptions(await screen.findByLabelText("Comercial"), "43");
    await waitFor(() => expect(lastCalendarUrl()).toContain("owner=43"));
  });

  it("un comercial no ve el filtro de comercial", async () => {
    await setup("sales");
    await screen.findAllByText("Visita a Servicios Sociales");
    expect(screen.queryByLabelText("Comercial")).not.toBeInTheDocument();
  });

  it("desde un día se crea una tarea con esa fecha", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "Día" }));
    await userEvent.click(await screen.findByRole("button", { name: "+ Tarea" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva tarea" });
    expect(within(dialog).getByLabelText("Fecha y hora")).toHaveValue("2026-10-01T09:00");
  });
});
