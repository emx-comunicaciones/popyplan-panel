import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "@/test-utils/axe";
import { render, screen, within } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildEntityCommunityRow, buildCommunityMember, buildCommunityDetail } from "@/test-utils/fixtures/community";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useEntityCommunitiesMock = vi.hoisted(() => vi.fn());
const useCommunityMembersMock = vi.hoisted(() => vi.fn());
const useCommunityPendingRequestsMock = vi.hoisted(() => vi.fn());
const useApproveCommunityMemberMock = vi.hoisted(() => vi.fn());
const useRejectCommunityMemberMock = vi.hoisted(() => vi.fn());
const useKickCommunityMemberMock = vi.hoisted(() => vi.fn());
const useChangeCommunityMemberRoleMock = vi.hoisted(() => vi.fn());
const useCreateCommunityMock = vi.hoisted(() => vi.fn());
const useCommunityMock = vi.hoisted(() => vi.fn());
const useUpdateCommunityMock = vi.hoisted(() => vi.fn());

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
vi.mock("@/hooks/useCreateCommunity", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCreateCommunity")>(
    "@/hooks/useCreateCommunity",
  );
  return { ...actual, useCreateCommunity: useCreateCommunityMock };
});
// `useCommunity`/`useUpdateCommunity` solo se disparan cuando el diálogo
// «Editar» está abierto (`EditarComunidadDialog` solo se monta con
// `editingCommunity`), así que la mayoría de tests de este fichero no
// necesita mockearlos — solo los que abren ese diálogo.
vi.mock("@/hooks/useCommunity", () => ({ useCommunity: useCommunityMock }));
vi.mock("@/hooks/useUpdateCommunity", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useUpdateCommunity")>(
    "@/hooks/useUpdateCommunity",
  );
  return { ...actual, useUpdateCommunity: useUpdateCommunityMock };
});

import EntidadComunidadesPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useEntityCommunitiesMock.mockReset();
  useCommunityMembersMock.mockReset();
  useCommunityPendingRequestsMock.mockReset();
  useApproveCommunityMemberMock.mockReset();
  useRejectCommunityMemberMock.mockReset();
  useKickCommunityMemberMock.mockReset();
  useChangeCommunityMemberRoleMock.mockReset();
  useCreateCommunityMock.mockReset();
  useCommunityMock.mockReset();
  useUpdateCommunityMock.mockReset();
});

function idleMutation() {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn() };
}

// `canManage` monta siempre `NuevaComunidadDialog` (aunque cerrado), así
// que cualquier test con rol titular/moderador tiene que mockear también
// `useCreateCommunity` (mismo patrón que `mockMutationDefaults` en
// `FamiliasPanel.test.tsx`).
function mockCreateCommunityDefault() {
  useCreateCommunityMock.mockReturnValue(idleMutation());
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
  return render(element);
}

describe("EntidadComunidadesPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Comunidades");
  });

  it("no tiene violaciones de accesibilidad (axe), con una comunidad abierta", async () => {
    const user = userEvent.setup();
    mockCreateCommunityDefault();
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
    useCommunityPendingRequestsMock.mockReturnValue({
      data: [buildCommunityMember({ id: "p1", full_name: "Bea Ruiz", status: "pending" })],
      isError: false,
      error: null,
    });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    const { container } = await renderPage();
    await user.click(screen.getByRole("button", { name: /Paseos al atardecer/ }));

    expect(await axe(container)).toHaveNoViolations();
  });

  it("no tiene violaciones de accesibilidad (axe) con el diálogo «Nueva comunidad» abierto", async () => {
    const user = userEvent.setup();
    mockCreateCommunityDefault();
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c1", name: "Paseos al atardecer" })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    const { container } = await renderPage();
    await user.click(screen.getByRole("button", { name: "Nueva comunidad" }));

    expect(await axe(container)).toHaveNoViolations();
  });

  it("lista las comunidades de la entidad con su actividad", async () => {
    mockCreateCommunityDefault();
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

  it("titular ve el botón «Nueva comunidad»", async () => {
    mockCreateCommunityDefault();
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ name: "Paseos al atardecer" })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage("titular");

    expect(screen.getByRole("button", { name: "Nueva comunidad" })).toBeInTheDocument();
  });

  it("dinamizador no ve el botón «Nueva comunidad»", async () => {
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ name: "Paseos al atardecer" })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage("dinamizador");

    expect(screen.queryByRole("button", { name: "Nueva comunidad" })).not.toBeInTheDocument();
  });

  it("«Nueva comunidad» crea con space:'members' y el id de la entidad vía el formulario", async () => {
    const mutate = vi.fn();
    useCreateCommunityMock.mockReturnValue({ ...idleMutation(), mutate });
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ name: "Paseos al atardecer" })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Nueva comunidad" }));
    await user.type(screen.getByLabelText("Nombre"), "Corredores del barrio");
    await user.click(screen.getByRole("button", { name: "Crear comunidad" }));

    expect(mutate).toHaveBeenCalledWith(
      {
        orgId: 7,
        space: "members",
        name: "Corredores del barrio",
        description: undefined,
        visibility: "open",
        codeOfConduct: undefined,
      },
      expect.anything(),
    );
  });

  it("al elegir una comunidad, pinta sus miembros y pendientes, y aprobar llama a la mutación", async () => {
    const user = userEvent.setup();
    mockCreateCommunityDefault();
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

  it("expulsar pide confirmación antes de llamar a la mutación", async () => {
    const user = userEvent.setup();
    mockCreateCommunityDefault();
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
    useKickCommunityMemberMock.mockReturnValue({ ...idleMutation(), mutate: kickMutate });
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage();
    await user.click(screen.getByRole("button", { name: /Paseos al atardecer/ }));
    await user.click(screen.getByRole("button", { name: "Expulsar" }));

    expect(kickMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", { name: "Expulsar de la comunidad" });
    expect(within(dialog).getByText(/Marta López/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Expulsar" }));

    expect(kickMutate).toHaveBeenCalledWith(
      { communityId: "c1", memberId: "m1" },
      expect.anything(),
    );
  });

  it("si expulsar falla, el error se lee dentro del diálogo", async () => {
    const user = userEvent.setup();
    mockCreateCommunityDefault();
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
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue({
      ...idleMutation(),
      isError: true,
      error: Object.assign(new Error("No se pudo expulsar a esa persona."), {
        kind: "kick",
        detail: "No se pudo expulsar a esa persona.",
      }),
    });
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage();
    await user.click(screen.getByRole("button", { name: /Paseos al atardecer/ }));
    await user.click(screen.getByRole("button", { name: "Expulsar" }));

    const dialog = screen.getByRole("alertdialog", { name: "Expulsar de la comunidad" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("No se pudo expulsar a esa persona.");
  });

  it("titular ve el botón «Editar» junto a la comunidad seleccionada", async () => {
    const user = userEvent.setup();
    mockCreateCommunityDefault();
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c1", name: "Paseos al atardecer" })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage("titular");
    await user.click(screen.getByRole("button", { name: /Paseos al atardecer/ }));

    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("dinamizador no ve el botón «Editar» junto a la comunidad seleccionada", async () => {
    const user = userEvent.setup();
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c1", name: "Paseos al atardecer" })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage("dinamizador");
    await user.click(screen.getByRole("button", { name: /Paseos al atardecer/ }));

    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("«Editar» abre el diálogo y guardar manda el PATCH con los cambios", async () => {
    const user = userEvent.setup();
    mockCreateCommunityDefault();
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c1", name: "Paseos al atardecer", space: "members" })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());
    useCommunityMock.mockReturnValue({
      data: buildCommunityDetail({ name: "Paseos al atardecer" }),
      isError: false,
      error: null,
    });
    const updateMutate = vi.fn();
    useUpdateCommunityMock.mockReturnValue({ ...idleMutation(), mutate: updateMutate });

    await renderPage("titular");
    await user.click(screen.getByRole("button", { name: /Paseos al atardecer/ }));
    await user.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByRole("heading", { name: "Editar comunidad" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Paseos al amanecer");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 7, communityId: "c1", space: "members", name: "Paseos al amanecer" }),
      expect.anything(),
    );
  });

  it("no tiene violaciones de accesibilidad (axe) con el diálogo «Editar» abierto", async () => {
    const user = userEvent.setup();
    mockCreateCommunityDefault();
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c1", name: "Paseos al atardecer" })],
      isError: false,
      error: null,
    });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());
    useCommunityMock.mockReturnValue({
      data: buildCommunityDetail({ name: "Paseos al atardecer" }),
      isError: false,
      error: null,
    });
    useUpdateCommunityMock.mockReturnValue(idleMutation());

    const { container } = await renderPage("titular");
    await user.click(screen.getByRole("button", { name: /Paseos al atardecer/ }));
    await user.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByRole("heading", { name: "Editar comunidad" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("sin comunidades muestra el estado vacío con el botón «Nueva comunidad»", async () => {
    mockCreateCommunityDefault();
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useCommunityMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useCommunityPendingRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useApproveCommunityMemberMock.mockReturnValue(idleMutation());
    useRejectCommunityMemberMock.mockReturnValue(idleMutation());
    useKickCommunityMemberMock.mockReturnValue(idleMutation());
    useChangeCommunityMemberRoleMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.getByText("Sin comunidades")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva comunidad" })).toBeInTheDocument();
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
