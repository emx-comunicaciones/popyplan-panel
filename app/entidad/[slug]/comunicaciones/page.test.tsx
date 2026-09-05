import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildAnnouncement } from "@/test-utils/fixtures/announcement";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useAnnouncementsMock = vi.hoisted(() => vi.fn());
const useSendAnnouncementMock = vi.hoisted(() => vi.fn());
const useEntityCommunitiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useAnnouncements", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useAnnouncements")>(
    "@/hooks/useAnnouncements",
  );
  return { ...actual, useAnnouncements: useAnnouncementsMock };
});
vi.mock("@/hooks/useSendAnnouncement", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useSendAnnouncement")>(
    "@/hooks/useSendAnnouncement",
  );
  return { ...actual, useSendAnnouncement: useSendAnnouncementMock };
});
vi.mock("@/hooks/useEntityCommunities", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useEntityCommunities")>(
    "@/hooks/useEntityCommunities",
  );
  return { ...actual, useEntityCommunities: useEntityCommunitiesMock };
});

import EntidadComunicacionesPage from "./page";

const community = {
  id: "c-1",
  name: "Comunidad de costura",
  visibility: "open",
  members_count: 10,
  active_members_count: 8,
  upcoming_events_count: 1,
  owner: { type: "organization", id: 7, name: "Alfaville", verified: true },
} as const;

afterEach(() => {
  getServerSessionMock.mockReset();
  useAnnouncementsMock.mockReset();
  useSendAnnouncementMock.mockReset();
  useEntityCommunitiesMock.mockReset();
});

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadComunicacionesPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadComunicacionesPage", () => {
  it("titular ve el formulario de redacción y el historial", async () => {
    useAnnouncementsMock.mockReturnValue({ data: [buildAnnouncement()], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [community], isError: false, error: null });
    useSendAnnouncementMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    await renderPage("titular");

    expect(screen.getByRole("heading", { name: "Comunicaciones" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar comunicación" })).toBeInTheDocument();
    expect(screen.getByText("Cerramos el jueves")).toBeInTheDocument();
    expect(screen.getByText(/5 destinatarios/)).toBeInTheDocument();
  });

  it("componer con audiencia 'Una comunidad' y confirmar llama a mutate con community:<uuid>", async () => {
    const mutate = vi.fn();
    useAnnouncementsMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [community], isError: false, error: null });
    useSendAnnouncementMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.type(screen.getByLabelText("Título"), "Aviso");
    await user.type(screen.getByLabelText("Cuerpo"), "Contenido del aviso");
    await user.click(screen.getByRole("radio", { name: "Una comunidad" }));
    await user.selectOptions(screen.getByLabelText("Comunidad"), "c-1");
    await user.click(screen.getByRole("button", { name: "Enviar comunicación" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(mutate).toHaveBeenCalledWith(
      { title: "Aviso", body: "Contenido del aviso", audience: "community:c-1" },
      expect.anything(),
    );
  });

  it("la opción 'Familias' está deshabilitada con la pista del espacio de familias", async () => {
    useAnnouncementsMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useSendAnnouncementMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    await renderPage("titular");

    expect(screen.getByRole("radio", { name: "Familias" })).toBeDisabled();
    expect(screen.getByText("Disponible cuando exista el espacio de familias.")).toBeInTheDocument();
  });

  it("moderador también ve el formulario de redacción", async () => {
    useAnnouncementsMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useSendAnnouncementMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    await renderPage("moderador");

    expect(screen.getByRole("button", { name: "Enviar comunicación" })).toBeInTheDocument();
  });

  it("dinamizador ve «Sin acceso» (la matriz de W1/W4a excluye Comunicaciones de su menú)", async () => {
    await renderPage("dinamizador");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar comunicación" })).not.toBeInTheDocument();
  });

  it("analista ve «Sin acceso»", async () => {
    await renderPage("analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadComunicacionesPage({ params: Promise.resolve({ slug: "alfaville" }) }),
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
      EntidadComunicacionesPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
