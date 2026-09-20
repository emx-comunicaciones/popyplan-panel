import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useEntityEventsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useEntityEvents", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useEntityEvents")>(
    "@/hooks/useEntityEvents",
  );
  return { ...actual, useEntityEvents: useEntityEventsMock };
});

import EntidadActividadesPage, { generateMetadata } from "./page";

const EVENT_ROW = {
  id: "e3",
  title: "E3",
  starts_at: "2026-01-08T18:00:00Z",
  status: "scheduled",
  audience: "community",
  community: { id: "c1", name: "Comunidad Uno" },
  organizer: { user_id: 1, public_name: "Titular" },
  capacity: null,
  registered: 1,
  attended: 2,
  no_show: 0,
};

afterEach(() => {
  getServerSessionMock.mockReset();
  useEntityEventsMock.mockReset();
});

async function renderPage(slug = "alfaville", role = "titular") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadActividadesPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadActividadesPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Actividades de la entidad");
  });

  it("muestra la actividad con estado/responsable/inscritos/asistió/no asistió y enlaza a asistencia", async () => {
    useEntityEventsMock.mockReturnValue({ data: [EVENT_ROW], isError: false, error: null });

    await renderPage();

    expect(screen.getByRole("heading", { name: "Actividades" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /E3/ })).toHaveAttribute(
      "href",
      "/entidad/alfaville/asistencia/e3",
    );
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Programada")).toBeInTheDocument();
    expect(table.getByText("Titular")).toBeInTheDocument();
  });

  it("organizer null (sin ver_lista_nominal) muestra «—»", async () => {
    useEntityEventsMock.mockReturnValue({
      data: [{ ...EVENT_ROW, organizer: null }],
      isError: false,
      error: null,
    });

    await renderPage();

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("cambiar el filtro de estado llama a useEntityEvents con el status elegido", async () => {
    useEntityEventsMock.mockReturnValue({ data: [EVENT_ROW], isError: false, error: null });
    const user = userEvent.setup();

    await renderPage();
    useEntityEventsMock.mockClear();
    await user.selectOptions(screen.getByLabelText("Estado"), "cancelled");

    expect(useEntityEventsMock).toHaveBeenLastCalledWith(7, expect.anything(), "cancelled");
  });

  it("arranca en el mes en curso y el selector de periodo llega a lo que viene (C-I8)", async () => {
    // Sin selector, el periodo estaba clavado del día 1 a hoy: las
    // actividades futuras no aparecían nunca y ningún mes anterior se
    // podía consultar.
    useEntityEventsMock.mockReturnValue({ data: [EVENT_ROW], isError: false, error: null });
    const user = userEvent.setup();

    await renderPage();

    const today = new Date();
    const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    expect(useEntityEventsMock).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ since: firstOfMonth }),
      undefined,
    );

    // Un `until` futuro es válido (ni el cliente ni `_periodo` del
    // backend ponen tope por arriba): así se ven las actividades que
    // vienen.
    await user.clear(screen.getByLabelText("Desde"));
    await user.type(screen.getByLabelText("Desde"), "2026-09-01");
    await user.clear(screen.getByLabelText("Hasta"));
    await user.type(screen.getByLabelText("Hasta"), "2027-06-30");
    useEntityEventsMock.mockClear();
    await user.click(screen.getByRole("button", { name: "Personalizado" }));

    expect(useEntityEventsMock).toHaveBeenLastCalledWith(
      7,
      { since: "2026-09-01", until: "2027-06-30" },
      undefined,
    );
  });

  it("sin actividades muestra el estado vacío", async () => {
    useEntityEventsMock.mockReturnValue({ data: [], isError: false, error: null });

    await renderPage();

    expect(screen.getByText("Sin actividades en este periodo")).toBeInTheDocument();
  });

  it("estado de error pinta ErrorState", async () => {
    useEntityEventsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar las actividades."),
    });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las actividades");
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadActividadesPage({ params: Promise.resolve({ slug: "alfaville" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>));
  });

  it("sin membresía en esa entidad redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: { role: null },
    });

    await expect(
      EntidadActividadesPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });

  it("analista no ve Actividades: «Sin acceso»", async () => {
    useEntityEventsMock.mockReturnValue({ data: [], isError: false, error: null });

    await renderPage("alfaville", "analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("referente sí ve Actividades", async () => {
    useEntityEventsMock.mockReturnValue({ data: [EVENT_ROW], isError: false, error: null });

    await renderPage("alfaville", "referente");

    expect(screen.getByRole("heading", { name: "Actividades" })).toBeInTheDocument();
    expect(screen.queryByText("Sin acceso")).not.toBeInTheDocument();
  });

  it("referente no ve enlaces a Asistencia (su rol no tiene esa sección)", async () => {
    useEntityEventsMock.mockReturnValue({ data: [EVENT_ROW], isError: false, error: null });

    await renderPage("alfaville", "referente");

    expect(screen.queryByRole("link", { name: /E3/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("E3")).toBeInTheDocument();
  });

  it("dinamizador sí ve el enlace a Asistencia", async () => {
    useEntityEventsMock.mockReturnValue({ data: [EVENT_ROW], isError: false, error: null });

    await renderPage("alfaville", "dinamizador");

    expect(screen.getByRole("link", { name: /E3/ })).toHaveAttribute(
      "href",
      "/entidad/alfaville/asistencia/e3",
    );
  });
});
