import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildEntityCommunityRow, buildCommunityMember } from "@/test-utils/fixtures/community";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useEntityCommunitiesMock = vi.hoisted(() => vi.fn());
const useCommunityMembersMock = vi.hoisted(() => vi.fn());
const useCommunityPendingRequestsMock = vi.hoisted(() => vi.fn());
const useApproveCommunityMemberMock = vi.hoisted(() => vi.fn());
const useRejectCommunityMemberMock = vi.hoisted(() => vi.fn());
const useKickCommunityMemberMock = vi.hoisted(() => vi.fn());
const useChangeCommunityMemberRoleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useEntityCommunities", () => ({ useEntityCommunities: useEntityCommunitiesMock }));
vi.mock("@/hooks/useCommunityMembers", () => ({
  useCommunityMembers: useCommunityMembersMock,
  useCommunityPendingRequests: useCommunityPendingRequestsMock,
}));
vi.mock("@/hooks/useCommunityMemberActions", () => ({
  useApproveCommunityMember: useApproveCommunityMemberMock,
  useRejectCommunityMember: useRejectCommunityMemberMock,
  useKickCommunityMember: useKickCommunityMemberMock,
  useChangeCommunityMemberRole: useChangeCommunityMemberRoleMock,
}));

import EntidadComunidadesPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useEntityCommunitiesMock.mockReset();
  useCommunityMembersMock.mockReset();
  useCommunityPendingRequestsMock.mockReset();
  useApproveCommunityMemberMock.mockReset();
  useRejectCommunityMemberMock.mockReset();
  useKickCommunityMemberMock.mockReset();
  useChangeCommunityMemberRoleMock.mockReset();
});

function idleMutation() {
  return { mutate: vi.fn(), isPending: false, isError: false };
}

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadComunidadesPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadComunidadesPage", () => {
  it("lista las comunidades de la entidad con su actividad", async () => {
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ name: "Paseos al atardecer", members_count: 12 })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.getByRole("heading", { name: "Comunidades" })).toBeInTheDocument();
    expect(screen.getByText("Paseos al atardecer")).toBeInTheDocument();
    expect(screen.getByText("12 miembros")).toBeInTheDocument();
  });

  it("al elegir una comunidad, pinta sus miembros y pendientes, y aprobar llama a la mutación", async () => {
    const user = userEvent.setup();
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c1", name: "Paseos al atardecer" })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({
      data: [buildCommunityMember({ id: "m1", full_name: "Marta López", role: "member" })],
      isError: false,
      error: null,
    });
    const pendingMember = buildCommunityMember({ id: "p1", full_name: "Bea Ruiz", status: "pending" });
    useCommunityPendingRequestsMock.mockReturnValue({
      data: [pendingMember],
      isError: false,
      error: null,
    });
    const approveMutate = vi.fn();
    useApproveCommunityMemberMock.mockReturnValue({ mutate: approveMutate, isPending: false, isError: false });
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage();
    await user.click(screen.getByRole("button", { name: /Paseos al atardecer/ }));

    expect(screen.getByText("Marta López")).toBeInTheDocument();
    expect(screen.getByText("Bea Ruiz")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Aprobar" }));
    expect(approveMutate).toHaveBeenCalledWith({ communityId: "c1", memberId: "p1" });
  });

  it("expulsar llama a la mutación con el id correcto", async () => {
    const user = userEvent.setup();
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c1", name: "Paseos al atardecer" })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({
      data: [buildCommunityMember({ id: "m1", full_name: "Marta López", role: "member" })],
      isError: false,
      error: null,
    });
    useCommunityPendingRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    const kickMutate = vi.fn();
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue({ mutate: kickMutate, isPending: false, isError: false });
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage();
    await user.click(screen.getByRole("button", { name: /Paseos al atardecer/ }));
    await user.click(screen.getByRole("button", { name: "Expulsar" }));

    expect(kickMutate).toHaveBeenCalledWith({ communityId: "c1", memberId: "m1" });
  });

  it("sin comunidades muestra el estado vacío", async () => {
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.getByText("Sin comunidades")).toBeInTheDocument();
  });

  it("analista no ve Comunidades: «Sin acceso»", async () => {
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage("analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadComunidadesPage({ params: Promise.resolve({ slug: "alfaville" }) }),
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
      EntidadComunidadesPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
