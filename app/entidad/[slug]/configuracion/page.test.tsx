import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildOrgMembershipFull } from "@/test-utils/fixtures/orgMembershipFull";
import type { Reference } from "@/lib/api/types";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useOrganizationMock = vi.hoisted(() => vi.fn());
const useUpdateOrganizationMock = vi.hoisted(() => vi.fn());
const useOrgMembersMock = vi.hoisted(() => vi.fn());
const useAddOrgMemberMock = vi.hoisted(() => vi.fn());
const useRemoveOrgMemberMock = vi.hoisted(() => vi.fn());
const useOrgReferencesMock = vi.hoisted(() => vi.fn());
const useCreateOrgReferenceMock = vi.hoisted(() => vi.fn());
const useRemoveOrgReferenceMock = vi.hoisted(() => vi.fn());
const useOrgScopeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useOrganization", () => ({ useOrganization: useOrganizationMock }));
vi.mock("@/hooks/useUpdateOrganization", () => ({ useUpdateOrganization: useUpdateOrganizationMock }));
vi.mock("@/hooks/useOrgMembers", () => ({
  useOrgMembers: useOrgMembersMock,
  useAddOrgMember: useAddOrgMemberMock,
  useRemoveOrgMember: useRemoveOrgMemberMock,
}));
vi.mock("@/hooks/useOrgReferences", () => ({
  useOrgReferences: useOrgReferencesMock,
  useCreateOrgReference: useCreateOrgReferenceMock,
  useRemoveOrgReference: useRemoveOrgReferenceMock,
}));
vi.mock("@/hooks/useOrgScope", () => ({ useOrgScope: useOrgScopeMock }));

import EntidadConfiguracionPage from "./page";

function idleMutation() {
  return { mutate: vi.fn(), isPending: false, isError: false, isSuccess: false };
}

afterEach(() => {
  getServerSessionMock.mockReset();
  useOrganizationMock.mockReset();
  useUpdateOrganizationMock.mockReset();
  useOrgMembersMock.mockReset();
  useAddOrgMemberMock.mockReset();
  useRemoveOrgMemberMock.mockReset();
  useOrgReferencesMock.mockReset();
  useCreateOrgReferenceMock.mockReset();
  useRemoveOrgReferenceMock.mockReset();
  useOrgScopeMock.mockReset();
});

function setDefaultMocks() {
  useOrganizationMock.mockReturnValue({ data: buildOrganization(), isError: false, error: null });
  useUpdateOrganizationMock.mockReturnValue(idleMutation());
  useOrgMembersMock.mockReturnValue({ data: [buildOrgMembershipFull()], isError: false, error: null });
  useAddOrgMemberMock.mockReturnValue(idleMutation());
  useRemoveOrgMemberMock.mockReturnValue(idleMutation());
  useOrgReferencesMock.mockReturnValue({ data: [], isError: false, error: null });
  useCreateOrgReferenceMock.mockReturnValue(idleMutation());
  useRemoveOrgReferenceMock.mockReturnValue(idleMutation());
  useOrgScopeMock.mockReturnValue(idleMutation());
}

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadConfiguracionPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadConfiguracionPage", () => {
  it("guarda los datos de la entidad", async () => {
    setDefaultMocks();
    const updateMutate = vi.fn();
    useUpdateOrganizationMock.mockReturnValue({
      mutate: updateMutate,
      isPending: false,
      isError: false,
      isSuccess: false,
    });
    const user = userEvent.setup();

    await renderPage();

    expect(screen.getByRole("heading", { name: "Configuración" })).toBeInTheDocument();
    const description = screen.getByLabelText("Descripción");
    await user.clear(description);
    await user.type(description, "Nueva descripción");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Nueva descripción" }),
    );
  });

  it("añadir miembro al equipo llama a la mutación con user y role", async () => {
    setDefaultMocks();
    const addMutate = vi.fn();
    useAddOrgMemberMock.mockReturnValue({ mutate: addMutate, isPending: false, isError: false });
    const user = userEvent.setup();

    await renderPage();

    await user.type(screen.getByLabelText("Id de usuario"), "55");
    await user.selectOptions(screen.getByLabelText("Rol"), "analista");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    expect(addMutate).toHaveBeenCalledWith({ user: 55, role: "analista" });
  });

  it("quitar del equipo llama a la mutación con el user id", async () => {
    setDefaultMocks();
    useOrgMembersMock.mockReturnValue({
      data: [buildOrgMembershipFull({ user: 88, public_name: "Carla" })],
      isError: false,
      error: null,
    });
    const removeMutate = vi.fn();
    useRemoveOrgMemberMock.mockReturnValue({ mutate: removeMutate, isPending: false, isError: false });
    const user = userEvent.setup();

    await renderPage();

    const equipoSection = screen.getByText("Carla").closest("table") as HTMLElement;
    await user.click(within(equipoSection).getByRole("button", { name: "Quitar" }));

    expect(removeMutate).toHaveBeenCalledWith(88);
  });

  it("asignar referencia llama a la mutación con user y referent_user", async () => {
    setDefaultMocks();
    const createMutate = vi.fn();
    useCreateOrgReferenceMock.mockReturnValue({ mutate: createMutate, isPending: false, isError: false });
    const user = userEvent.setup();

    await renderPage();

    await user.type(screen.getByLabelText("Persona (id)"), "42");
    await user.type(screen.getByLabelText("Referente (id)"), "9");
    await user.click(screen.getByRole("button", { name: "Asignar" }));

    expect(createMutate).toHaveBeenCalledWith({ user: 42, referent_user: 9 });
  });

  it("lista referencias existentes y quitar llama a la mutación", async () => {
    setDefaultMocks();
    const reference = {
      id: 1,
      organization: 7,
      referent: 9,
      user: 42,
      created_at: "2026-01-05T09:00:00Z",
      public_name: "Bea",
      photo: "",
    } as Reference;
    useOrgReferencesMock.mockReturnValue({ data: [reference], isError: false, error: null });
    const removeMutate = vi.fn();
    useRemoveOrgReferenceMock.mockReturnValue({ mutate: removeMutate, isPending: false, isError: false });
    const user = userEvent.setup();

    await renderPage();

    expect(screen.getByText("Bea — referente #9")).toBeInTheDocument();
    const referenciasCard = screen.getByText("Referencias").parentElement as HTMLElement;
    await user.click(within(referenciasCard).getByRole("button", { name: "Quitar" }));

    expect(removeMutate).toHaveBeenCalledWith(42);
  });

  it("ampliar ámbito por municipios llama a la mutación con places", async () => {
    setDefaultMocks();
    const scopeMutate = vi.fn();
    useOrgScopeMock.mockReturnValue({ mutate: scopeMutate, isPending: false, isError: false, isSuccess: false });
    const user = userEvent.setup();

    await renderPage();

    await user.type(screen.getByLabelText("Códigos INE, separados por coma"), "30001, 30002");
    await user.click(screen.getByRole("button", { name: "Ampliar ámbito" }));

    expect(scopeMutate).toHaveBeenCalledWith({ places: ["30001", "30002"] });
  });

  it("ampliar ámbito por comarca llama a la mutación con comarca", async () => {
    setDefaultMocks();
    const scopeMutate = vi.fn();
    useOrgScopeMock.mockReturnValue({ mutate: scopeMutate, isPending: false, isError: false, isSuccess: false });
    const user = userEvent.setup();

    await renderPage();

    await user.selectOptions(screen.getByLabelText("Tipo"), "comarca");
    await user.type(screen.getByLabelText("Código"), "vega-alta");
    await user.click(screen.getByRole("button", { name: "Ampliar ámbito" }));

    expect(scopeMutate).toHaveBeenCalledWith({ comarca: "vega-alta" });
  });

  it("moderador no ve la sección Equipo (GET de equipo solo titular) pero sí el resto", async () => {
    setDefaultMocks();

    await renderPage("moderador");

    expect(screen.queryByLabelText("Id de usuario")).not.toBeInTheDocument();
    expect(useOrgMembersMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Persona (id)")).toBeInTheDocument();
    expect(screen.getByLabelText("Códigos INE, separados por coma")).toBeInTheDocument();
  });

  it("dinamizador no ve Configuración: «Sin acceso»", async () => {
    setDefaultMocks();

    await renderPage("dinamizador");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("analista no ve Configuración: «Sin acceso»", async () => {
    setDefaultMocks();

    await renderPage("analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadConfiguracionPage({ params: Promise.resolve({ slug: "alfaville" }) }),
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
      EntidadConfiguracionPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
