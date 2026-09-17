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

import EntidadActividadesPage from "./page";

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
});
