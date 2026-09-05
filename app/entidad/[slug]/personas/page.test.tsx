import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const usePeopleMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/usePeople", () => ({ usePeople: usePeopleMock }));

import EntidadPersonasPage from "./page";

const PERSON_ROW = {
  user_id: 42,
  public_name: "Ana",
  photo: null,
  joined_at: "2025-01-01T09:00:00Z",
  communities_count: 1,
  events_period: 3,
  attended_period: 3,
  referent: { user_id: 7, public_name: "Bea" },
  next_event: { id: "e1", title: "Taller", starts_at: "2026-09-08T18:00:00Z" },
};

function pageData(overrides: Record<string, unknown> = {}) {
  return { count: 1, next: null, previous: null, results: [PERSON_ROW], ...overrides };
}

afterEach(() => {
  getServerSessionMock.mockReset();
  usePeopleMock.mockReset();
});

async function renderPage(slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role: "titular", organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadPersonasPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadPersonasPage", () => {
  it("muestra la fila de Ana con sus datos y enlaza a la ficha", async () => {
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });

    await renderPage();

    expect(screen.getByRole("heading", { name: "Personas" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Ana" });
    expect(link).toHaveAttribute("href", "/entidad/alfaville/personas/42");
    expect(screen.getByText("Bea")).toBeInTheDocument();
    expect(screen.getByText("1/1/2025")).toBeInTheDocument();
  });

  it("sin referente muestra «Sin referente»", async () => {
    usePeopleMock.mockReturnValue({
      data: pageData({ results: [{ ...PERSON_ROW, referent: null }] }),
      isError: false,
      error: null,
    });

    await renderPage();

    expect(screen.getByText("Sin referente")).toBeInTheDocument();
  });

  it("escribir en los filtros llama a usePeople con la query exacta", async () => {
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });
    const user = userEvent.setup();

    await renderPage();
    usePeopleMock.mockClear();

    await user.type(screen.getByLabelText("Buscar"), "an");
    await user.type(screen.getByLabelText("Comunidad"), "comm-1");
    await user.type(screen.getByLabelText("Referente"), "7");

    const lastCall = usePeopleMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(7);
    expect(lastCall?.[2]).toMatchObject({ search: "an", community: "comm-1", referent: 7 });
  });

  it("paginación: sin `previous`, «Anterior» está deshabilitado; con `next`, «Siguiente» no", async () => {
    usePeopleMock.mockReturnValue({
      data: pageData({ next: "http://api.test/next", previous: null }),
      isError: false,
      error: null,
    });

    await renderPage();

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  });

  it("«Siguiente» avanza de página (usePeople recibe page:2)", async () => {
    usePeopleMock.mockReturnValue({
      data: pageData({ next: "http://api.test/next", previous: null }),
      isError: false,
      error: null,
    });
    const user = userEvent.setup();

    await renderPage();
    usePeopleMock.mockClear();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    const lastCall = usePeopleMock.mock.calls.at(-1);
    expect(lastCall?.[2]).toMatchObject({ page: 2 });
  });

  it("sin resultados muestra el estado vacío", async () => {
    usePeopleMock.mockReturnValue({ data: pageData({ count: 0, results: [] }), isError: false, error: null });

    await renderPage();

    expect(screen.getByText("Sin personas con estos filtros")).toBeInTheDocument();
  });

  it("estado de error pinta ErrorState", async () => {
    usePeopleMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudo cargar el listado de personas."),
    });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las personas");
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadPersonasPage({ params: Promise.resolve({ slug: "alfaville" }) }),
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
      EntidadPersonasPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
