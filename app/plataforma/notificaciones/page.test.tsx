import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { ApiError } from "@/lib/api/client";
import type { NotificationTemplateRow } from "@/lib/api/types";
import { act, fireEvent, render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaNotificacionesPage, { generateMetadata } from "./page";

afterEach(() => {
  vi.useRealTimers();
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const TEMPLATE: NotificationTemplateRow = {
  id: 4,
  name: "Aviso de reporte",
  notification_type: "report_resolved",
  title_template: "Your report was resolved",
  message_template: "Thanks, {name}",
  email_subject_template: "",
  email_body_template: "",
  is_active: true,
  priority: "high",
  created_at: "2026-09-20T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z",
};

interface BackendOptions {
  send?: () => unknown;
  templates?: () => unknown;
  save?: () => unknown;
  remove?: () => unknown;
}

function mockBackend(options: BackendOptions = {}) {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path.startsWith("/api/users/users/")) {
      return { count: 1, next: null, previous: null, results: [{ id: 13, username: "p01", email: "p01@test.com" }] };
    }
    if (path === "/api/notifications/send/") return options.send ? options.send() : { detail: "ok", recipients: 1 };
    if (path.startsWith("/api/notification-templates/?page=")) {
      return options.templates ? options.templates() : { count: 1, next: null, previous: null, results: [TEMPLATE] };
    }
    if (path.startsWith("/api/notification-templates/") && init?.method === "DELETE") {
      return options.remove ? options.remove() : undefined;
    }
    if (path.startsWith("/api/notification-templates/")) return options.save ? options.save() : TEMPLATE;
    throw new Error(`sin mock para ${path}`);
  });
}

function superadmin() {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole("superadmin"),
  });
}

async function renderPage() {
  return render(await PlataformaNotificacionesPage());
}

async function fillMessage() {
  await userEvent.type(screen.getByLabelText("Título"), "Mantenimiento");
  await userEvent.type(screen.getByLabelText("Mensaje"), "Esta noche paramos 10 minutos.");
}

describe("PlataformaNotificacionesPage", () => {
  it("no tiene violaciones de accesibilidad (axe), con la confirmación y el diálogo de plantilla abiertos", async () => {
    mockBackend();
    superadmin();
    const { container } = await renderPage();
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByLabelText("Todas las personas"));
    await fillMessage();
    await userEvent.click(screen.getByRole("button", { name: "Enviar notificación" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    await userEvent.click(screen.getByRole("button", { name: "Plantillas" }));
    await screen.findByText("Aviso de reporte");
    await userEvent.click(screen.getByRole("button", { name: "Nueva plantilla" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Notificaciones");
  });

  it("a una persona: exige elegirla, confirma y dice a cuántas llegó", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    expect(screen.getByRole("button", { name: "Enviar" })).toHaveAttribute("aria-pressed", "true");
    await fillMessage();
    const submit = screen.getByRole("button", { name: "Enviar notificación" });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Buscar cuenta (correo o usuario)"), "p01");
    await userEvent.click(await screen.findByRole("button", { name: "p01 (p01@test.com)" }));
    expect(screen.getByText("Se enviará a p01.")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "warning");
    await userEvent.selectOptions(screen.getByLabelText("Prioridad"), "urgent");
    await userEvent.click(submit);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("La notificación llegará a p01.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar notificación" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Enviada a 1 persona.");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/notifications/send/", {
      method: "POST",
      body: {
        title: "Mantenimiento",
        message: "Esta noche paramos 10 minutos.",
        notification_type: "warning",
        priority: "urgent",
        target: "user",
        user_id: 13,
      },
    });
    expect(screen.getByLabelText("Título")).toHaveValue("");
  });

  it("a todas: avisa de que incluye al personal y, encolado, lo dice", async () => {
    mockBackend({ send: () => ({ detail: "Bulk send queued." }) });
    superadmin();
    await renderPage();
    await userEvent.click(screen.getByLabelText("Todas las personas"));
    expect(screen.getByText(/incluido el personal de plataforma/)).toBeInTheDocument();
    await fillMessage();
    await userEvent.click(screen.getByRole("button", { name: "Enviar notificación" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Enviar a todas las personas?");
    expect(dialog).toHaveTextContent("No se puede deshacer");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar notificación" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Envío masivo en cola");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/notifications/send/",
      expect.objectContaining({ body: expect.objectContaining({ target: "all", notification_type: "announcement" }) }),
    );
    const sent = apiFetchMock.mock.calls.find(([path]) => path === "/api/notifications/send/");
    expect(sent?.[1].body).not.toHaveProperty("user_id");
  });

  it("un error al enviar se queda dentro de la confirmación; Cancelar lo limpia", async () => {
    mockBackend({
      send: () => {
        throw new ApiError(400, { user_id: ["Cuenta inactiva."] });
      },
    });
    superadmin();
    await renderPage();
    await userEvent.click(screen.getByLabelText("Todas las personas"));
    await fillMessage();
    await userEvent.click(screen.getByRole("button", { name: "Enviar notificación" }));
    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar notificación" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Cuenta inactiva.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("el buscador de cuentas espera a que se deje de teclear", async () => {
    vi.useFakeTimers();
    mockBackend();
    superadmin();
    await renderPage();
    const input = screen.getByLabelText("Buscar cuenta (correo o usuario)");
    for (const value of ["p", "p0", "p01"]) fireEvent.change(input, { target: { value } });
    expect(apiFetchMock).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/users/?search=p01");
  });

  it("plantillas: tabla, alta, edición y borrado", async () => {
    mockBackend();
    superadmin();
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Plantillas" }));
    const row = (await screen.findByText("Aviso de reporte")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Alta")).toBeInTheDocument();
    expect(within(row).getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText("1 plantilla")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Nueva plantilla" }));
    const createDialog = screen.getByRole("dialog");
    const save = within(createDialog).getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    await userEvent.type(within(createDialog).getByLabelText("Nombre"), "Recordatorio");
    await userEvent.type(within(createDialog).getByLabelText("Título (plantilla)"), "Reminder");
    await userEvent.type(within(createDialog).getByLabelText("Mensaje (plantilla)"), "See you");
    await userEvent.type(within(createDialog).getByLabelText("Asunto del correo (opcional)"), "S");
    await userEvent.type(within(createDialog).getByLabelText("Cuerpo del correo (opcional)"), "B");
    await userEvent.selectOptions(within(createDialog).getByLabelText("Tipo"), "plan_reminder");
    await userEvent.selectOptions(within(createDialog).getByLabelText("Prioridad"), "low");
    await userEvent.click(within(createDialog).getByLabelText("Activa"));
    await userEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/notification-templates/", {
      method: "POST",
      body: {
        name: "Recordatorio",
        notification_type: "plan_reminder",
        title_template: "Reminder",
        message_template: "See you",
        email_subject_template: "S",
        email_body_template: "B",
        is_active: true,
        priority: "low",
      },
    });

    await userEvent.click(within(row).getByRole("button", { name: "Editar" }));
    const editDialog = screen.getByRole("dialog");
    expect(within(editDialog).getByLabelText("Nombre")).toHaveValue("Aviso de reporte");
    await userEvent.click(within(editDialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/notification-templates/4/",
      expect.objectContaining({ method: "PATCH" }),
    );

    await userEvent.click(within(row).getByRole("button", { name: "Borrar" }));
    const confirm = screen.getByRole("alertdialog");
    expect(confirm).toHaveTextContent("Se borra «Aviso de reporte».");
    await userEvent.click(within(confirm).getByRole("button", { name: "Borrar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/notification-templates/4/", { method: "DELETE" });
  });

  it("plantillas: errores al guardar y al borrar quedan dentro; Cancelar cierra", async () => {
    mockBackend({
      save: () => {
        throw new ApiError(400, { name: ["Obligatorio."] });
      },
      remove: () => {
        throw new ApiError(404, null);
      },
    });
    superadmin();
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Plantillas" }));
    const row = (await screen.findByText("Aviso de reporte")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Obligatorio.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: "Borrar" }));
    const confirm = screen.getByRole("alertdialog");
    await userEvent.click(within(confirm).getByRole("button", { name: "Borrar" }));
    expect(await within(confirm).findByRole("alert")).toHaveTextContent("Ya no existe.");
    await userEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("plantillas: vacío y error de carga", async () => {
    mockBackend({ templates: () => ({ count: 0, next: null, previous: null, results: [] }) });
    superadmin();
    const { unmount } = await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Plantillas" }));
    expect(await screen.findByText("No hay plantillas")).toBeInTheDocument();
    unmount();

    mockBackend({
      templates: () => {
        throw new ApiError(500, null);
      },
    });
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Plantillas" }));
    expect(await screen.findByText("No se pudieron cargar las plantillas")).toBeInTheDocument();
  });

  it("plantillas: paginación, y vuelta a la primera si la página deja de existir", async () => {
    let second = 0;
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/notification-templates/?page=1") {
        return { count: 21, next: "x", previous: null, results: [TEMPLATE] };
      }
      if (path === "/api/notification-templates/?page=2") {
        second += 1;
        if (second === 1) return { count: 21, next: null, previous: "x", results: [{ ...TEMPLATE, id: 9, name: "Otra" }] };
        throw new ApiError(404, null);
      }
      throw new Error(`sin mock para ${path}`);
    });
    superadmin();
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Plantillas" }));
    await screen.findByText("Aviso de reporte");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByText("Otra")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByText("Aviso de reporte")).toBeInTheDocument();
  });

  it("moderator ve «Sin acceso»; sin sesión va a /login; sin rol de plataforma a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });
    render(await PlataformaNotificacionesPage());
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();

    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaNotificacionesPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });
    await expect(PlataformaNotificacionesPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
