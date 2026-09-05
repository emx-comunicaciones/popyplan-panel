import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildReportRow } from "@/test-utils/fixtures/report";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useReportsQueueMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useReportsQueue", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useReportsQueue")>(
    "@/hooks/useReportsQueue",
  );
  return { ...actual, useReportsQueue: useReportsQueueMock };
});

import EntidadReportesPage from "./page";

// Array plano de verdad (no `{count, ...}`, docs/SEGURIDAD_Y_MODERACION.md §4).
function pageData() {
  return [buildReportRow()];
}

afterEach(() => {
  getServerSessionMock.mockReset();
  useReportsQueueMock.mockReset();
});

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadReportesPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadReportesPage", () => {
  it("lista los reportes con enlace al detalle", async () => {
    useReportsQueueMock.mockReturnValue({ data: pageData(), isError: false, error: null });

    await renderPage();

    expect(screen.getByRole("heading", { name: "Reportes" })).toBeInTheDocument();
    expect(screen.getByText("Acoso")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Ver detalle" });
    expect(link).toHaveAttribute("href", "/entidad/alfaville/reportes/11111111-1111-1111-1111-111111111111");
  });

  it("cambiar el filtro de estado llama a useReportsQueue con el status exacto", async () => {
    useReportsQueueMock.mockReturnValue({ data: pageData(), isError: false, error: null });
    const user = userEvent.setup();

    await renderPage();
    useReportsQueueMock.mockClear();

    await user.selectOptions(screen.getByLabelText("Estado"), "resolved");

    const lastCall = useReportsQueueMock.mock.calls.at(-1);
    expect(lastCall?.[1]).toMatchObject({ status: "resolved" });
  });

  it("sin reportes muestra el estado vacío", async () => {
    useReportsQueueMock.mockReturnValue({ data: [], isError: false, error: null });

    await renderPage();

    expect(screen.getByText("Sin reportes con este filtro")).toBeInTheDocument();
  });

  it("estado de error pinta ErrorState", async () => {
    useReportsQueueMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudo cargar la cola de reportes."),
    });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar la cola de reportes");
  });

  it("dinamizador no ve Reportes: «Sin acceso»", async () => {
    useReportsQueueMock.mockReturnValue({ data: pageData(), isError: false, error: null });

    await renderPage("dinamizador");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadReportesPage({ params: Promise.resolve({ slug: "alfaville" }) }),
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
      EntidadReportesPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
