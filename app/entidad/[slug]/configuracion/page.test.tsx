import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "@/test-utils/axe";
import { act, render, screen, within } from "@/test-utils/render";
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

import EntidadConfiguracionPage, { generateMetadata } from "./page";

const REFERENCE = {
  id: 1,
  organization: 7,
  referent: 9,
  user: 42,
  created_at: "2026-01-05T09:00:00Z",
  public_name: "Bea",
  photo: "",
} as Reference;

function idleMutation() {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  };
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
  return render(element);
}

describe("EntidadConfiguracionPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Configuración de la entidad");
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    setDefaultMocks();
    useOrgMembersMock.mockReturnValue({
      data: [buildOrgMembershipFull({ user: 88, public_name: "Carla" })],
      isError: false,
      error: null,
    });
    useOrgReferencesMock.mockReturnValue({
      data: [
        {
          id: 1,
          organization: 7,
          referent: 88,
          user: 42,
          created_at: "2026-01-05T09:00:00Z",
          public_name: "Bea",
          photo: "",
        } as Reference,
      ],
      isError: false,
      error: null,
    });

    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });

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
      expect.anything(),
    );
  });

  it("elegir un logo válido lo manda junto al resto de la ficha al guardar", async () => {
    setDefaultMocks();
    const updateMutate = vi.fn();
    useUpdateOrganizationMock.mockReturnValue({ ...idleMutation(), mutate: updateMutate });
    const user = userEvent.setup();

    await renderPage();

    const logo = new File(["png"], "logo.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Logo"), logo);
    expect(screen.getByText("Fichero elegido: logo.png")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ logo, primary_color: expect.any(String) }),
      expect.anything(),
    );
  });

  it("un logo en un formato no admitido se rechaza en el cliente y no se manda", async () => {
    setDefaultMocks();
    const updateMutate = vi.fn();
    useUpdateOrganizationMock.mockReturnValue({ ...idleMutation(), mutate: updateMutate });
    // `applyAccept: false`: el `accept` del control filtra en el navegador,
    // pero la validación del cliente tiene que aguantar igual un fichero
    // que llegue por otro camino (arrastrar, un navegador sin filtro).
    const user = userEvent.setup({ applyAccept: false });

    await renderPage();

    const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    await user.upload(screen.getByLabelText("Logo"), svg);
    expect(screen.getByRole("alert")).toHaveTextContent("Formato no admitido");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0][0]).not.toHaveProperty("logo");
  });

  it("el titular puede cambiar la sede de su entidad", async () => {
    setDefaultMocks();
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ place: "20069" }),
      isError: false,
      error: null,
    });

    await renderPage("titular");

    expect(screen.getByLabelText("Municipio de la sede")).toBeInTheDocument();
    expect(screen.getByLabelText("Municipio de la sede")).toHaveValue("20069");
  });

  /**
   * I5 de la revisión final de rama: la sede es obligatoria también en
   * edición (spec §2.1) — una entidad antigua sin sede no puede guardar
   * el resto de sus datos hasta elegir un municipio, con el motivo
   * explicado junto al selector.
   */
  it("sin sede, «Guardar» queda deshabilitado con el motivo explicado (I5)", async () => {
    setDefaultMocks();
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ place: null }),
      isError: false,
      error: null,
    });

    await renderPage("titular");

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(
      screen.getByText("La sede es obligatoria: elige un municipio para poder guardar."),
    ).toBeInTheDocument();
  });

  it("guardar la sede manda `place` junto al resto de la lista blanca", async () => {
    setDefaultMocks();
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ place: "20069" }),
      isError: false,
      error: null,
    });
    const updateMutate = vi.fn();
    useUpdateOrganizationMock.mockReturnValue({
      mutate: updateMutate,
      isPending: false,
      isError: false,
      isSuccess: false,
    });
    const user = userEvent.setup();

    await renderPage("titular");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateMutate).toHaveBeenCalledWith(expect.objectContaining({ place: "20069" }), expect.anything());
  });

  it("añadir miembro al equipo llama a la mutación con user y role", async () => {
    setDefaultMocks();
    const addMutate = vi.fn();
    useAddOrgMemberMock.mockReturnValue({ ...idleMutation(), mutate: addMutate });
    const user = userEvent.setup();

    await renderPage();

    await user.type(screen.getByLabelText("Id de usuario"), "55");
    await user.selectOptions(screen.getByLabelText("Rol"), "analista");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    expect(addMutate).toHaveBeenCalledWith({ user: 55, role: "analista" }, expect.anything());
  });

  it("quitar del equipo pide confirmación antes de llamar a la mutación", async () => {
    setDefaultMocks();
    useOrgMembersMock.mockReturnValue({
      data: [buildOrgMembershipFull({ user: 88, public_name: "Carla" })],
      isError: false,
      error: null,
    });
    const removeMutate = vi.fn();
    useRemoveOrgMemberMock.mockReturnValue({
      ...idleMutation(),
      mutate: removeMutate,
    });
    const user = userEvent.setup();

    await renderPage();

    const equipoSection = screen.getByText("Carla").closest("table") as HTMLElement;
    await user.click(within(equipoSection).getByRole("button", { name: "Quitar" }));

    expect(removeMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", { name: "Quitar del equipo" });
    expect(within(dialog).getByText(/Carla/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Quitar" }));

    expect(removeMutate).toHaveBeenCalledWith(88, expect.anything());
  });

  it("quitarse a uno mismo del equipo avisa de que se pierde el acceso al panel", async () => {
    setDefaultMocks();
    // `buildMe` da id 42, el mismo `user` que `buildOrgMembershipFull`.
    useOrgMembersMock.mockReturnValue({
      data: [buildOrgMembershipFull({ user: 42, public_name: "Ana" })],
      isError: false,
      error: null,
    });
    useRemoveOrgMemberMock.mockReturnValue(idleMutation());
    const user = userEvent.setup();

    await renderPage();

    const equipoSection = screen.getByText("Ana").closest("table") as HTMLElement;
    await user.click(within(equipoSection).getByRole("button", { name: "Quitar" }));

    const dialog = screen.getByRole("alertdialog", { name: "Quitar del equipo" });
    expect(
      within(dialog).getByText("Vas a quitarte a ti mismo del equipo y perderás el acceso al panel."),
    ).toBeInTheDocument();
  });

  it("quitar a otra persona del equipo no avisa de pérdida de acceso propia", async () => {
    setDefaultMocks();
    useOrgMembersMock.mockReturnValue({
      data: [buildOrgMembershipFull({ user: 88, public_name: "Carla" })],
      isError: false,
      error: null,
    });
    useRemoveOrgMemberMock.mockReturnValue(idleMutation());
    const user = userEvent.setup();

    await renderPage();

    const equipoSection = screen.getByText("Carla").closest("table") as HTMLElement;
    await user.click(within(equipoSection).getByRole("button", { name: "Quitar" }));

    expect(
      screen.queryByText("Vas a quitarte a ti mismo del equipo y perderás el acceso al panel."),
    ).not.toBeInTheDocument();
  });

  it("si quitar del equipo falla, el error se lee dentro del diálogo, que sigue abierto", async () => {
    setDefaultMocks();
    useOrgMembersMock.mockReturnValue({
      data: [buildOrgMembershipFull({ user: 88, public_name: "Carla" })],
      isError: false,
      error: null,
    });
    useRemoveOrgMemberMock.mockReturnValue({
      ...idleMutation(),
      isError: true,
      error: {
        message: "Solo el titular puede quitar del equipo.",
        kind: "sin_acceso",
        detail: "Solo el titular puede quitar del equipo.",
      },
    });
    const user = userEvent.setup();

    await renderPage();

    const equipoSection = screen.getByText("Carla").closest("table") as HTMLElement;
    await user.click(within(equipoSection).getByRole("button", { name: "Quitar" }));

    const dialog = screen.getByRole("alertdialog", { name: "Quitar del equipo" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Solo el titular puede quitar del equipo.",
    );
  });

  it("añadir miembro: los campos solo se limpian cuando el alta sale bien", async () => {
    setDefaultMocks();
    const addMutate = vi.fn();
    useAddOrgMemberMock.mockReturnValue({ ...idleMutation(), mutate: addMutate });
    const user = userEvent.setup();

    await renderPage();

    await user.type(screen.getByLabelText("Id de usuario"), "55");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    // El backend responde 400: la mutación no llama a `onSuccess` y el
    // valor escrito sigue ahí para corregirlo.
    expect(screen.getByLabelText("Id de usuario")).toHaveValue(55);

    const options = addMutate.mock.calls.at(-1)?.[1] as { onSuccess: () => void };
    await act(async () => options.onSuccess());

    expect(screen.getByLabelText("Id de usuario")).toHaveValue(null);
  });

  it("asignar referencia: los campos solo se limpian cuando el alta sale bien", async () => {
    setDefaultMocks();
    const createMutate = vi.fn();
    useCreateOrgReferenceMock.mockReturnValue({ ...idleMutation(), mutate: createMutate });
    const user = userEvent.setup();

    await renderPage();

    await user.type(screen.getByLabelText("Persona (id)"), "42");
    await user.type(screen.getByLabelText("Referente (id)"), "9");
    await user.click(screen.getByRole("button", { name: "Asignar" }));

    expect(screen.getByLabelText("Persona (id)")).toHaveValue(42);
    expect(screen.getByLabelText("Referente (id)")).toHaveValue(9);

    const options = createMutate.mock.calls.at(-1)?.[1] as { onSuccess: () => void };
    await act(async () => options.onSuccess());

    expect(screen.getByLabelText("Persona (id)")).toHaveValue(null);
    expect(screen.getByLabelText("Referente (id)")).toHaveValue(null);
  });

  it("asignar referencia llama a la mutación con user y referent_user", async () => {
    setDefaultMocks();
    const createMutate = vi.fn();
    useCreateOrgReferenceMock.mockReturnValue({ ...idleMutation(), mutate: createMutate });
    const user = userEvent.setup();

    await renderPage();

    await user.type(screen.getByLabelText("Persona (id)"), "42");
    await user.type(screen.getByLabelText("Referente (id)"), "9");
    await user.click(screen.getByRole("button", { name: "Asignar" }));

    expect(createMutate).toHaveBeenCalledWith({ user: 42, referent_user: 9 }, expect.anything());
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
    useOrgMembersMock.mockReturnValue({
      // `Reference.referent` es el id de la MEMBRESÍA (`id: 9`), no el de
      // la cuenta (`user: 11`): A-I4.
      data: [buildOrgMembershipFull({ id: 9, user: 11, role: "referente", public_name: "Ana" })],
      isError: false,
      error: null,
    });
    const removeMutate = vi.fn();
    useRemoveOrgReferenceMock.mockReturnValue({ ...idleMutation(), mutate: removeMutate });
    const user = userEvent.setup();

    await renderPage();

    // El nombre del referente no viene en `Reference` (solo su id): se
    // resuelve contra el equipo ya cargado en esta misma pestaña.
    expect(screen.getByText("Bea — Referente: Ana")).toBeInTheDocument();
    const referenciasCard = screen.getByText("Referencias").parentElement as HTMLElement;
    await user.click(within(referenciasCard).getByRole("button", { name: "Quitar" }));

    expect(removeMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", { name: "Quitar referencia" });
    await user.click(within(dialog).getByRole("button", { name: "Quitar" }));

    expect(removeMutate).toHaveBeenCalledWith(42, expect.anything());
  });

  it("resuelve el referente por el id de su MEMBRESÍA, no por el de su cuenta (A-I4)", async () => {
    // Caso de colisión real: la membresía 9 (cuenta 11, «Ana») es la
    // referente de la referencia; la membresía 3 es de la cuenta 9
    // («Carlos»). Comparando contra `OrgMembership.user` —lo que hacía
    // el panel— salía «Carlos», el nombre de otra persona.
    setDefaultMocks();
    useOrgReferencesMock.mockReturnValue({ data: [REFERENCE], isError: false, error: null });
    useOrgMembersMock.mockReturnValue({
      data: [
        buildOrgMembershipFull({ id: 3, user: 9, role: "moderador", public_name: "Carlos" }),
        buildOrgMembershipFull({ id: 9, user: 11, role: "referente", public_name: "Ana" }),
      ],
      isError: false,
      error: null,
    });

    await renderPage();

    expect(screen.getByText("Bea — Referente: Ana")).toBeInTheDocument();
    // «Carlos» sí aparece en la tabla de Equipo de la misma pestaña; lo
    // que no puede es figurar como referente de Bea.
    expect(screen.queryByText("Bea — Referente: Carlos")).not.toBeInTheDocument();
  });

  it("mientras carga el equipo, el nombre del referente no se da por perdido", async () => {
    setDefaultMocks();
    useOrgMembersMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useOrgReferencesMock.mockReturnValue({ data: [REFERENCE], isError: false, error: null });

    await renderPage();

    expect(screen.getByText("Bea — Referente…")).toBeInTheDocument();
    expect(screen.queryByText(/sin nombre/)).not.toBeInTheDocument();
  });

  it("si el equipo falla, la referencia lo dice en vez de fingir que no hay nombre", async () => {
    setDefaultMocks();
    useOrgMembersMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("Solo el titular puede ver el equipo de la entidad."),
    });
    useOrgReferencesMock.mockReturnValue({ data: [REFERENCE], isError: false, error: null });

    await renderPage();

    expect(screen.getByText("Bea — Referente no disponible")).toBeInTheDocument();
  });

  it("una referencia cuyo referente no está en el equipo cargado no enseña su id", async () => {
    setDefaultMocks();
    useOrgMembersMock.mockReturnValue({ data: [], isError: false, error: null });
    useOrgReferencesMock.mockReturnValue({
      data: [
        {
          id: 1,
          organization: 7,
          referent: 9,
          user: 42,
          created_at: "2026-01-05T09:00:00Z",
          public_name: "Bea",
          photo: "",
        } as Reference,
      ],
      isError: false,
      error: null,
    });

    await renderPage();

    expect(screen.getByText("Bea — Referente sin nombre")).toBeInTheDocument();
    expect(screen.queryByText(/referente #9/)).not.toBeInTheDocument();
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
