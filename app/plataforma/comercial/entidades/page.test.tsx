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
import { axe } from "@/test-utils/axe";
import { buildCrmAccount, buildCrmAccountDetail, CRM_STAGES, CRM_USER, CRM_USER_2, paginated } from "@/test-utils/fixtures/crm";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { routerMock } from "@/test-utils/nextNavigationMock";
import { fireEvent, render, screen, waitFor, within } from "@/test-utils/render";

import PlataformaComercialEntidadesPage, { generateMetadata } from "./page";

const ACCOUNT = buildCrmAccount();
const OTHER = buildCrmAccount({ id: 2, name: "Diputación Foral de Gipuzkoa", kind: "provincial_council", owner: CRM_USER_2, last_activity_at: null, next_activity_at: null, days_without_contact: null, open_value: null, place: null, tags: [] });

function route(overrides: Record<string, (path: string, options?: { method?: string; body?: unknown }) => unknown> = {}) {
  apiFetchMock.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
    for (const [prefix, handler] of Object.entries(overrides)) {
      if (path.startsWith(prefix)) return handler(path, options);
    }
    if (path.startsWith("/api/crm/accounts/duplicates/")) return [];
    if (path.startsWith("/api/crm/accounts/")) return paginated([ACCOUNT, OTHER]);
    if (path.startsWith("/api/crm/stages/")) return CRM_STAGES;
    if (path.startsWith("/api/crm/tags/")) return [{ id: 1, name: "Adicciones", color: "" }];
    if (path.startsWith("/api/crm/users/")) return [CRM_USER, CRM_USER_2];
    if (path.startsWith("/api/crm/catalog/")) return [{ id: 3, kind: "source", name: "Prospección comercial", order: 0, is_active: true }];
    throw new Error(`sin mock para ${path}`);
  });
}

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

async function renderPage(role: string | null = "sales") {
  getServerSessionMock.mockResolvedValue({ token: "t", me: buildMe({ org_memberships: [] }), platformRole: buildPlatformRole(role as never) });
  return render(await PlataformaComercialEntidadesPage());
}

const accountCalls = () =>
  apiFetchMock.mock.calls.map((c) => c[0] as string).filter((p) => p.startsWith("/api/crm/accounts/?"));

describe("PlataformaComercialEntidadesPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    route();
    const { container } = await renderPage();
    await screen.findByRole("link", { name: "Ayuntamiento de Donostia" });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página", async () => {
    expect((await generateMetadata()).title).toBe("Entidades");
  });

  it("lista las entidades con responsable, valor abierto y enlace a la ficha", async () => {
    route();
    await renderPage();
    const link = await screen.findByRole("link", { name: "Ayuntamiento de Donostia" });
    expect(link).toHaveAttribute("href", "/plataforma/comercial/entidades/1");
    const table = screen.getByRole("table", { name: "Entidades del CRM comercial" });
    const row = within(table).getByText("Ayuntamiento de Donostia").closest("tr") as HTMLElement;
    expect(within(row).getByText("Mikel Errasti")).toBeInTheDocument();
    expect(within(row).getByText("Interesado")).toBeInTheDocument();
    expect(within(row).getByText(/8\.?000/)).toBeInTheDocument();
    expect(within(row).getByText("Adicciones")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Entidades" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Necesitan atención" })).toHaveAttribute("href", "/plataforma/comercial/atencion");
  });

  it("un comercial no ve el filtro de responsable; dirección sí", async () => {
    route();
    const { unmount } = await renderPage("sales");
    await screen.findByRole("link", { name: "Ayuntamiento de Donostia" });
    expect(screen.queryByLabelText("Responsable")).not.toBeInTheDocument();
    unmount();
    await renderPage("sales_lead");
    expect(await screen.findByLabelText("Responsable")).toBeInTheDocument();
  });

  it("los filtros cambian la URL que se pide", async () => {
    route();
    const user = userEvent.setup();
    await renderPage("sales_lead");
    await screen.findByRole("link", { name: "Ayuntamiento de Donostia" });

    await user.selectOptions(screen.getByLabelText("Tipo"), "city_council");
    await waitFor(() => expect(accountCalls().some((p) => p.includes("kind=city_council"))).toBe(true));

    await user.selectOptions(screen.getByLabelText("Cliente"), "true");
    await waitFor(() => expect(accountCalls().some((p) => p.includes("client=true"))).toBe(true));

    await user.click(screen.getByLabelText("Nunca contactadas"));
    await waitFor(() => expect(accountCalls().some((p) => p.includes("never_contacted=true"))).toBe(true));

    await user.selectOptions(screen.getByLabelText("Ordenar por"), "-open_value");
    await waitFor(() => expect(accountCalls().some((p) => p.includes("ordering=-open_value"))).toBe(true));

    await user.selectOptions(screen.getByLabelText("Responsable"), String(CRM_USER_2.id));
    await waitFor(() => expect(accountCalls().some((p) => p.includes(`owner=${CRM_USER_2.id}`))).toBe(true));
  });

  it("la búsqueda espera 300 ms antes de pedir", async () => {
    route();
    await renderPage();
    await screen.findByRole("link", { name: "Ayuntamiento de Donostia" });
    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByLabelText("Buscar por nombre, municipio o CIF"), { target: { value: "irun" } });
      expect(accountCalls().some((p) => p.includes("q=irun"))).toBe(false);
      const { act } = await import("@testing-library/react");
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(accountCalls().some((p) => p.includes("q=irun"))).toBe(true));
  });

  it("«+ Nueva entidad» crea la entidad y abre su ficha", async () => {
    route({
      "/api/crm/accounts/": (path, options) =>
        options?.method === "POST" ? buildCrmAccountDetail({ id: 9, name: "Ayuntamiento de Irun" }) : paginated([ACCOUNT]),
    });
    const user = userEvent.setup();
    await renderPage();
    await screen.findByRole("link", { name: "Ayuntamiento de Donostia" });

    await user.click(screen.getByRole("button", { name: "+ Nueva entidad" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre"), "Ayuntamiento de Irun");
    await user.click(within(dialog).getByRole("button", { name: "Crear entidad" }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/plataforma/comercial/entidades/9"));
    const post = apiFetchMock.mock.calls.find((c) => c[1]?.method === "POST");
    expect(post?.[1].body).toMatchObject({ name: "Ayuntamiento de Irun", kind: "city_council", force: false });
  });

  it("un 409 enseña los duplicados y «Crear igualmente» reenvía con force", async () => {
    let posts = 0;
    route({
      "/api/crm/accounts/": (path, options) => {
        if (options?.method !== "POST") return paginated([ACCOUNT]);
        posts += 1;
        if (posts === 1) {
          throw new ApiError(409, {
            detail: "Ya existe una entidad parecida.",
            duplicates: [{ id: 1, name: "Ayuntamiento de Donostia", municipality: "Donostia/San Sebastián", owner_name: "Mikel Errasti" }],
          });
        }
        return buildCrmAccountDetail({ id: 10, name: "Ayuntamiento de Donostia" });
      },
    });
    const user = userEvent.setup();
    await renderPage();
    await screen.findByRole("link", { name: "Ayuntamiento de Donostia" });

    await user.click(screen.getByRole("button", { name: "+ Nueva entidad" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre"), "Ayuntamiento de Donostia");
    await user.click(within(dialog).getByRole("button", { name: "Crear entidad" }));

    const open = await within(dialog).findByRole("link", { name: "Abrir existente" });
    expect(open).toHaveAttribute("href", "/plataforma/comercial/entidades/1");
    expect(routerMock.push).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Crear igualmente" }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/plataforma/comercial/entidades/10"));
    const forced = apiFetchMock.mock.calls.filter((c) => c[1]?.method === "POST").at(-1);
    expect(forced?.[1].body).toMatchObject({ force: true });
  });

  it("avisa de posibles duplicados mientras se escribe el nombre", async () => {
    route({
      "/api/crm/accounts/duplicates/": () => [{ id: 1, name: "Ayuntamiento de Donostia", municipality: "Donostia/San Sebastián", owner_name: "Mikel Errasti" }],
    });
    const user = userEvent.setup();
    await renderPage();
    await screen.findByRole("link", { name: "Ayuntamiento de Donostia" });
    await user.click(screen.getByRole("button", { name: "+ Nueva entidad" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre"), "Ayuntamiento");
    expect(await within(dialog).findByText("Posibles duplicados")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Abrir existente" })).toBeInTheDocument();
  });

  it("importar: vista previa con errores y duplicados, y resultado del alta", async () => {
    route({
      "/api/crm/import/preview/": () => [
        { row: 2, data: { name: "Ayuntamiento de Zarautz", municipality: "Zarautz" }, place: "20079", place_name: "Zarautz", errors: [], duplicates: [] },
        { row: 3, data: { name: "" }, place: null, place_name: "", errors: ["Falta el nombre."], duplicates: [] },
        { row: 4, data: { name: "Ayuntamiento de Donostia" }, place: null, place_name: "", errors: [], duplicates: [{ id: 1, name: "Ayuntamiento de Donostia" }] },
      ],
      "/api/crm/import/commit/": () => ({ created: 1, skipped: 2 }),
    });
    const user = userEvent.setup();
    await renderPage("sales_lead");
    await screen.findByRole("link", { name: "Ayuntamiento de Donostia" });
    await user.click(screen.getByRole("button", { name: "Importar" }));
    const dialog = await screen.findByRole("dialog");
    const file = new File(["nombre\nZarautz"], "entidades.csv", { type: "text/csv" });
    await user.upload(within(dialog).getByLabelText("Fichero CSV o XLSX"), file);
    expect(await within(dialog).findByText("Falta el nombre.")).toBeInTheDocument();
    expect(within(dialog).getByText(/3 filas: 1 con errores, 1 posibles duplicados/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Importar" }));
    expect(await within(dialog).findByText(/1 entidad creada, 2 omitidas/)).toBeInTheDocument();
    const commit = apiFetchMock.mock.calls.find((c) => c[0] === "/api/crm/import/commit/");
    expect(commit?.[1].body).toMatchObject({ include_duplicates: false });
  });

  it("muestra el vacío cuando no hay entidades y el error cuando falla la carga", async () => {
    route({ "/api/crm/accounts/?": () => paginated([]) });
    const { unmount } = await renderPage();
    expect(await screen.findByText(/Todavía no hay entidades/)).toBeInTheDocument();
    unmount();
    route({ "/api/crm/accounts/?": () => { throw new ApiError(500, {}); } });
    await renderPage();
    expect(await screen.findByText("No se pudieron cargar las entidades.")).toBeInTheDocument();
  });
});
