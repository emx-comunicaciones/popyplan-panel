import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock, fetchWithAuth: fetchWithAuthMock };
});
const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { ApiError } from "@/lib/api/client";
import { axe } from "@/test-utils/axe";
import {
  CRM_STAGES,
  CRM_USER,
  CRM_USER_2,
  buildCrmAccountDetail,
  buildCrmContact,
  buildCrmDocument,
  buildCrmOpportunity,
  buildCrmSummary,
  buildCrmTask,
  buildCrmTimelineEvent,
  paginated,
} from "@/test-utils/fixtures/crm";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { NextNotFoundSignal, routerMock } from "@/test-utils/nextNavigationMock";
import { render, screen, waitFor, within } from "@/test-utils/render";

import { CrmProvider } from "@/components/crm/CrmShell";

import PlataformaComercialEntidadFichaPage from "./page";

type Handler = (path: string, options?: { method?: string; body?: Record<string, unknown> }) => unknown;

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const inDaysIso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function route(overrides: Record<string, Handler> = {}) {
  apiFetchMock.mockImplementation(async (path: string, options?: { method?: string; body?: Record<string, unknown> }) => {
    for (const [key, handler] of Object.entries(overrides)) {
      // «MÉTODO /ruta»: la regla solo vale para ese método.
      const [method, prefix] = key.includes(" ") ? key.split(" ") : [undefined, key];
      if (method && (options?.method ?? "GET") !== method) continue;
      if (path.startsWith(prefix)) return handler(path, options);
    }
    if (path.startsWith("/api/crm/accounts/1/summary/")) {
      return buildCrmSummary({
        account: buildCrmAccountDetail({ last_activity_at: daysAgoIso(3), next_activity_at: inDaysIso(2) }),
        next: { type: "activity", kind: "meeting", title: "Reunión de seguimiento", at: inDaysIso(2), owner_name: "Mikel Errasti" },
      });
    }
    if (path.startsWith("/api/crm/accounts/1/timeline/")) {
      return paginated([
        buildCrmTimelineEvent(),
        buildCrmTimelineEvent({
          id: 901,
          kind: "stage",
          activity: null,
          payload: { actor_name: "Carlos Pérez", from_stage: "Contactado", to_stage: "Interesado" },
        }),
        buildCrmTimelineEvent({
          id: 902,
          kind: "owner",
          activity: null,
          payload: { actor_name: "Carlos Pérez", from_owner: "Mikel Errasti", to_owner: "Carlos Pérez" },
        }),
      ]);
    }
    if (path.startsWith("/api/crm/accounts/1/contacts/")) {
      if (options?.method === "POST") return buildCrmContact({ id: 8 });
      return [buildCrmContact()];
    }
    if (path.startsWith("/api/crm/accounts/1/relations/")) {
      return [{ id: 5, source: 1, source_name: "Ayuntamiento de Donostia", target: 2, target_name: "Diputación Foral de Gipuzkoa", kind: "parent", notes: "", created_at: "2026-09-01T00:00:00Z" }];
    }
    if (path.startsWith("/api/crm/accounts/1/owner-history/")) {
      return [{ from: "", to: "Mikel Errasti", by: "Carlos Pérez", at: "2026-09-01T10:00:00Z" }];
    }
    if (path.startsWith("/api/crm/opportunities/")) {
      return paginated([
        buildCrmOpportunity({
          available_budget: "120000.00",
          budget_line: "Partida 231",
          funding: "Presupuesto municipal",
          eu_funds: true,
          file_number: "EXP-2026/123",
          procurement_manager: "Ana Ruiz",
          required_documents: "Declaración responsable",
          contract: { id: 1, opportunity: 30, final_amount: "96000.00", awarded_at: "2026-11-01", renewal_date: "2027-11-01" } as never,
        }),
      ]);
    }
    if (path.startsWith("/api/crm/tasks/") && options?.method === "PATCH") return buildCrmTask({ status: "done" });
    if (path.startsWith("/api/crm/tasks/")) return paginated(path.includes("bucket=done") ? [] : [buildCrmTask()]);
    if (path.startsWith("/api/crm/documents/")) return paginated([buildCrmDocument()]);
    if (path.startsWith("/api/crm/users/")) return [CRM_USER, CRM_USER_2];
    if (path.startsWith("/api/crm/stages/")) return CRM_STAGES;
    if (path.startsWith("/api/crm/catalog/")) return [{ id: 40, kind: "product", name: "Popyplan Asociaciones", order: 0, is_active: true }];
    if (path.startsWith("/api/crm/tags/")) return [];
    if (path.startsWith("/api/crm/accounts/duplicates/")) return [];
    if (path.startsWith("/api/crm/accounts/")) return paginated([]);
    throw new Error(`sin mock para ${path} (${options?.method ?? "GET"})`);
  });
}

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
  fetchWithAuthMock.mockReset();
});

async function renderPage(role: string | null = "sales", id = "1") {
  getServerSessionMock.mockResolvedValue({ token: "t", me: buildMe({ id: 42, org_memberships: [] }), platformRole: buildPlatformRole(role as never) });
  return render(await PlataformaComercialEntidadFichaPage({ params: Promise.resolve({ id }) }));
}

const calls = (method?: string) =>
  apiFetchMock.mock.calls.filter((c) => (c[1]?.method ?? "GET") === (method ?? "GET")).map((c) => c[0] as string);

describe("PlataformaComercialEntidadFichaPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    route();
    const { container } = await renderPage();
    await screen.findByRole("heading", { level: 1, name: "Ayuntamiento de Donostia" });
    await screen.findByText("Enviar dossier y propuesta");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("un id que no es numérico es un 404 y no pide nada", async () => {
    route();
    await expect(renderPage("sales", "abc")).rejects.toBeInstanceOf(NextNotFoundSignal);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("la cabecera responde de un vistazo: responsable, último contacto, próxima actividad", async () => {
    route();
    await renderPage();
    const header = (await screen.findByRole("heading", { level: 1, name: "Ayuntamiento de Donostia" })).closest("header") as HTMLElement;
    expect(within(header).getByText(/Donostia\/San Sebastián · Gipuzkoa · 187\.000 habitantes/)).toBeInTheDocument();
    expect(within(header).getByText("Interesado")).toBeInTheDocument();
    expect(within(header).getByText("Mikel Errasti")).toBeInTheDocument();
    expect(within(header).getByText("hace 3 días")).toBeInTheDocument();
    expect(within(header).getByText(/Reunión – /)).toBeInTheDocument();
    for (const name of ["+ Nueva actividad", "+ Programar reunión", "+ Crear tarea", "+ Añadir contacto", "+ Crear oportunidad", "+ Subir documento", "+ Añadir nota"]) {
      expect(within(header).getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("el resumen enseña lo último que pasó, contactos, valor, tareas y notas destacadas", async () => {
    route();
    await renderPage();
    expect(await screen.findByText("Interesados en la parte de asociaciones.")).toBeInTheDocument();
    expect(screen.getByText(/Con: María Etxeberria/)).toBeInTheDocument();
    expect(screen.getByText(/Resultado: Positivo/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "943111111" })).toHaveAttribute("href", "tel:943111111");
    expect(screen.getByRole("link", { name: "maria@donostia.eus" })).toHaveAttribute("href", "mailto:maria@donostia.eus");
    expect(screen.getByRole("link", { name: "Popyplan Asociaciones" })).toHaveAttribute("href", "/plataforma/comercial/oportunidades/30");
    expect(screen.getByText(/Valor total: 8\.?000/)).toBeInTheDocument();
    expect(screen.getByText(/IMPORTANTE: el responsable/)).toBeInTheDocument();
    expect(screen.getByText("Propuestas enviadas")).toBeInTheDocument();
  });

  it("completar una tarea del resumen con un clic marca la tarea como hecha", async () => {
    route();
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "Completar tarea: Enviar dossier y propuesta" }));
    await waitFor(() => expect(calls("PATCH")).toContain("/api/crm/tasks/200/"));
    const patch = apiFetchMock.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(patch?.[1].body).toEqual({ status: "done" });
  });

  it("el selector de secciones usa aria-pressed y no tiene pestañas ARIA", async () => {
    route();
    const user = userEvent.setup();
    await renderPage();
    await screen.findByRole("heading", { level: 1, name: "Ayuntamiento de Donostia" });
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resumen" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Historial" }));
    expect(screen.getByRole("button", { name: "Historial" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Resumen" })).toHaveAttribute("aria-pressed", "false");
  });

  it("el historial lee cada evento de su payload y se puede filtrar", async () => {
    route();
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "Historial" }));
    expect(await screen.findByText(/Visita presencial · Reunión con Servicios Sociales/)).toBeInTheDocument();
    expect(screen.getByText(/María Etxeberria \(Responsable de Servicios Sociales\)/)).toBeInTheDocument();
    expect(screen.getByText(/Duración: 55 min/)).toBeInTheDocument();
    expect(screen.getByText(/Siguiente paso: Enviar dossier y propuesta/)).toBeInTheDocument();
    expect(screen.getByText("Contactado → Interesado")).toBeInTheDocument();
    expect(screen.getByText("Responsable: Mikel Errasti → Carlos Pérez")).toBeInTheDocument();
    expect(screen.getAllByText("por Carlos Pérez").length).toBe(2);

    await user.selectOptions(screen.getByLabelText("Mostrar"), "activity,activity_edited");
    await waitFor(() => expect(calls().some((p) => p.includes("kind=activity%2Cactivity_edited"))).toBe(true));
  });

  it("«Cargar más» pide la página siguiente del historial", async () => {
    route({
      "/api/crm/accounts/1/timeline/": (path) =>
        path.includes("page=2")
          ? { count: 21, next: null, previous: null, results: [buildCrmTimelineEvent({ id: 950, kind: "note", activity: null, payload: { actor_name: "Mikel Errasti", body: "Nota antigua", important: false, pinned: false } })] }
          : { count: 21, next: "http://api/api/crm/accounts/1/timeline/?page=2", previous: null, results: [buildCrmTimelineEvent()] },
    });
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "Historial" }));
    await user.click(await screen.findByRole("button", { name: "Cargar más" }));
    expect(await screen.findByText("Nota antigua")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
  });

  it("contactos: lista con enlaces tel y mailto y borra con confirmación", async () => {
    route({ "/api/crm/contacts/7/": () => undefined });
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "Contactos" }));
    const table = await screen.findByRole("table", { name: "Contactos de la entidad" });
    expect(within(table).getByText("(principal)")).toBeInTheDocument();
    await user.click(within(table).getByRole("button", { name: "Eliminar contacto María Etxeberria" }));
    const confirm = screen.getByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(calls("DELETE")).toContain("/api/crm/contacts/7/"));
  });

  it("«+ Añadir contacto»: un 409 enseña los duplicados y «Añadir igualmente» fuerza", async () => {
    let posts = 0;
    route({
      "/api/crm/accounts/1/contacts/": (path, options) => {
        if (options?.method !== "POST") return [buildCrmContact()];
        posts += 1;
        if (posts === 1) {
          throw new ApiError(409, {
            detail: "Ya existe un contacto con ese email o teléfono.",
            duplicates: [{ id: 7, name: "María Etxeberria", account: 1, account_name: "Ayuntamiento de Donostia" }],
          });
        }
        return buildCrmContact({ id: 8 });
      },
    });
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "+ Añadir contacto" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre"), "María");
    await user.type(within(dialog).getByLabelText("Email"), "maria@donostia.eus");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(dialog).findByRole("link", { name: "Abrir existente" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Añadir igualmente" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const forced = apiFetchMock.mock.calls.filter((c) => c[1]?.method === "POST").at(-1);
    expect(forced?.[1].body).toMatchObject({ first_name: "María", force: true });
  });

  it("«+ Programar reunión» rechaza una fecha pasada y guarda una futura como actividad", async () => {
    route({ "/api/crm/activities/": () => ({ id: 1 }) });
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "+ Programar reunión" }));
    const dialog = await screen.findByRole("dialog");
    const at = within(dialog).getByLabelText("Fecha y hora");
    await user.clear(at);
    await user.type(at, "2020-01-01T10:00");
    await user.click(within(dialog).getByRole("button", { name: "Programar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/debe ser futura/);
    expect(calls("POST")).toHaveLength(0);

    await user.clear(at);
    await user.type(at, "2099-01-01T10:00");
    await user.type(within(dialog).getByLabelText("Título"), "Presentar propuesta");
    await user.click(within(dialog).getByRole("button", { name: "Programar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const post = apiFetchMock.mock.calls.find((c) => c[1]?.method === "POST");
    expect(post?.[0]).toBe("/api/crm/activities/");
    expect(post?.[1].body).toMatchObject({ account: 1, kind: "meeting", title: "Presentar propuesta" });
    expect(new Date(post?.[1].body.occurred_at as string).getFullYear()).toBe(2099);
  });

  it("«+ Crear tarea» crea la tarea de la entidad", async () => {
    route({ "/api/crm/tasks/": (path, options) => (options?.method === "POST" ? buildCrmTask({ id: 201 }) : paginated([buildCrmTask()])) });
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "+ Crear tarea" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Qué hay que hacer"), "Llamar al concejal");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const post = apiFetchMock.mock.calls.find((c) => c[1]?.method === "POST");
    expect(post?.[1].body).toMatchObject({ account: 1, title: "Llamar al concejal", assignee: 42 });
  });

  it("«+ Añadir nota» y «+ Crear oportunidad» guardan y la oportunidad enlaza a su ficha", async () => {
    route({
      "/api/crm/accounts/1/notes/": () => ({ id: 1 }),
      "/api/crm/opportunities/": (path, options) => (options?.method === "POST" ? buildCrmOpportunity({ id: 77 }) : paginated([])),
    });
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "+ Añadir nota" }));
    let dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nota"), "Pidió presupuesto");
    await user.click(within(dialog).getByLabelText("Importante"));
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetchMock.mock.calls.find((c) => c[0] === "/api/crm/accounts/1/notes/")?.[1].body).toMatchObject({ body: "Pidió presupuesto", important: true, pinned: false });

    await user.click(screen.getByRole("button", { name: "+ Crear oportunidad" }));
    dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre"), "Popyplan Mayores");
    await user.type(within(dialog).getByLabelText("Importe estimado (€)"), "5000");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    const open = await within(dialog).findByRole("link", { name: "Abrir oportunidad" });
    expect(open).toHaveAttribute("href", "/plataforma/comercial/oportunidades/77");
  });

  it("«+ Subir documento» sube el fichero con su categoría", async () => {
    route({ "/api/crm/documents/": (path, options) => (options?.method === "POST" ? buildCrmDocument() : paginated([buildCrmDocument()])) });
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "+ Subir documento" }));
    const dialog = await screen.findByRole("dialog");
    await user.upload(within(dialog).getByLabelText("Fichero"), new File(["x"], "pliego.pdf", { type: "application/pdf" }));
    await user.selectOptions(within(dialog).getByLabelText("Categoría"), "tender");
    await user.click(within(dialog).getByLabelText("Recibido de la entidad"));
    await user.click(within(dialog).getByRole("button", { name: "Subir" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const post = apiFetchMock.mock.calls.find((c) => c[1]?.method === "POST");
    const form = post?.[1].body as FormData;
    expect(form.get("category")).toBe("tender");
    expect(form.get("received")).toBe("true");
    expect(form.get("account")).toBe("1");
    expect((form.get("file") as File).name).toBe("pliego.pdf");
  });

  it("documentos: «Ver» abre la última versión en línea", async () => {
    route();
    fetchWithAuthMock.mockResolvedValue({ blob: async () => new Blob(["x"]), headers: new Headers() });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    URL.createObjectURL = vi.fn(() => "blob:x");
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "Documentos" }));
    expect(await screen.findByText("Propuesta Popyplan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver Propuesta Popyplan" }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/crm/documents/500/versions/501/download/?inline=1");
    open.mockRestore();
  });

  it("tareas: separa abiertas y completadas y permite cancelar", async () => {
    route();
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "Tareas" }));
    expect(await screen.findByRole("table", { name: "Tareas abiertas de la entidad" })).toBeInTheDocument();
    expect(await screen.findByText("No hay tareas completadas.")).toBeInTheDocument();
    expect(calls().some((p) => p.includes("bucket=open") && p.includes("account=1") && p.includes("mine=false"))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Cancelar tarea: Enviar dossier y propuesta" }));
    await waitFor(() => expect(calls("PATCH")).toContain("/api/crm/tasks/200/"));
    expect(apiFetchMock.mock.calls.find((c) => c[1]?.method === "PATCH")?.[1].body).toEqual({ status: "cancelled" });
  });

  it("oportunidades y contratación: campos de contratación pública y renovación", async () => {
    route();
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole("button", { name: "Oportunidades" }));
    expect(await screen.findByRole("table", { name: "Oportunidades de la entidad" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Contratación" }));
    expect(await screen.findByText("EXP-2026/123")).toBeInTheDocument();
    expect(screen.getByText("Partida 231")).toBeInTheDocument();
    expect(screen.getByText("Fondos europeos")).toBeInTheDocument();
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText(/Fecha de renovación:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar en la oportunidad" })).toHaveAttribute("href", "/plataforma/comercial/oportunidades/30");
  });

  it("datos: dirección ve responsable, colaboradores, relaciones y «Eliminar entidad»; un comercial no", async () => {
    route();
    const user = userEvent.setup();
    const { unmount } = await renderPage("sales_lead");
    await user.click(await screen.findByRole("button", { name: "Datos" }));
    expect(await screen.findByLabelText("Responsable")).toBeInTheDocument();
    expect(screen.getByText("Colaboradores")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Diputación Foral de Gipuzkoa" })).toBeInTheDocument();
    expect(await screen.findByText(/Carlos Pérez, /)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Eliminar entidad" }).length).toBe(1);
    unmount();

    await renderPage("sales");
    await user.click(await screen.findByRole("button", { name: "Datos" }));
    await screen.findByLabelText("Nombre");
    expect(screen.queryByLabelText("Responsable")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar entidad" })).not.toBeInTheDocument();
  });

  it("datos: guardar manda los cambios con las etiquetas por nombre", async () => {
    route({ "PATCH /api/crm/accounts/1/": () => buildCrmAccountDetail() });
    const user = userEvent.setup();
    await renderPage("sales");
    await user.click(await screen.findByRole("button", { name: "Datos" }));
    const tags = await screen.findByLabelText("Etiquetas");
    await user.clear(tags);
    await user.type(tags, "Adicciones, Mayores");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Cambios guardados.")).toBeInTheDocument();
    const patch = apiFetchMock.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(patch?.[0]).toBe("/api/crm/accounts/1/");
    expect(patch?.[1].body).toMatchObject({ tags: ["Adicciones", "Mayores"], place: "20069" });
    expect(patch?.[1].body).not.toHaveProperty("owner");
  });

  it("datos: eliminar la entidad pide confirmación y vuelve al listado", async () => {
    route({ "DELETE /api/crm/accounts/1/": () => undefined });
    const user = userEvent.setup();
    await renderPage("sales_lead");
    await user.click(await screen.findByRole("button", { name: "Datos" }));
    await user.click(await screen.findByRole("button", { name: "Eliminar entidad" }));
    const confirm = screen.getByRole("alertdialog");
    expect(calls("DELETE")).toHaveLength(0);
    await user.click(within(confirm).getByRole("button", { name: "Eliminar entidad" }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/plataforma/comercial/entidades"));
    expect(calls("DELETE")).toContain("/api/crm/accounts/1/");
  });

  it("datos: quitar y añadir relaciones con otras entidades", async () => {
    route({
      "/api/crm/accounts/1/relations/": (path, options) =>
        options?.method === "POST" ? { id: 6 } : [{ id: 5, source: 1, source_name: "Ayuntamiento de Donostia", target: 2, target_name: "Diputación Foral de Gipuzkoa", kind: "parent", notes: "", created_at: "2026-09-01T00:00:00Z" }],
      "/api/crm/relations/5/": () => undefined,
      "/api/crm/accounts/?": () => paginated([{ id: 3, name: "Asociación Aitzina", place: null }]),
    });
    const user = userEvent.setup();
    await renderPage("sales");
    await user.click(await screen.findByRole("button", { name: "Datos" }));
    await user.click(await screen.findByRole("button", { name: "Quitar la relación con Diputación Foral de Gipuzkoa" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(calls("DELETE")).toContain("/api/crm/relations/5/"));

    await user.type(screen.getByLabelText("Entidad relacionada"), "Aitz");
    await user.click(await screen.findByRole("button", { name: "Asociación Aitzina" }));
    await user.selectOptions(screen.getByLabelText("Relación"), "member");
    await user.click(screen.getByRole("button", { name: "Añadir relación" }));
    await waitFor(() => expect(calls("POST")).toContain("/api/crm/accounts/1/relations/"));
    expect(apiFetchMock.mock.calls.find((c) => c[1]?.method === "POST")?.[1].body).toEqual({ target: 3, kind: "member" });
  });

  it("si la entidad no existe o no la lleva esta persona lo dice", async () => {
    route({ "/api/crm/accounts/1/summary/": () => { throw new ApiError(404, { detail: "No encontrado." }); } });
    await renderPage();
    expect(await screen.findByText("No se pudo cargar la entidad.")).toBeInTheDocument();
    expect(screen.getByText("No encontrado.")).toBeInTheDocument();
  });

  it("«+ Nueva actividad» abre el registro rápido con la entidad ya elegida", async () => {
    route();
    getServerSessionMock.mockResolvedValue({ token: "t", me: buildMe({ id: 42, org_memberships: [] }), platformRole: buildPlatformRole("sales") });
    const element = await PlataformaComercialEntidadFichaPage({ params: Promise.resolve({ id: "1" }) });
    const user = userEvent.setup();
    render(
      <CrmProvider isManager={false} userId={42}>
        {element}
      </CrmProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "+ Nueva actividad" }));
    const dialog = await screen.findByRole("dialog", { name: "Registrar actividad" });
    expect(within(dialog).getByRole("group", { name: "Entidad" })).toHaveTextContent("Ayuntamiento de Donostia");
  });
});
