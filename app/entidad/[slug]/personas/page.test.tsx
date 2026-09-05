import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildEntityCommunityRow } from "@/test-utils/fixtures/community";
import { buildOrgMembershipFull } from "@/test-utils/fixtures/orgMembershipFull";
import { buildEntityInvitation, buildInvitedPersonRow } from "@/test-utils/fixtures/invitation";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const usePeopleMock = vi.hoisted(() => vi.fn());
const useInvitationsMock = vi.hoisted(() => vi.fn());
const useResendInvitationMock = vi.hoisted(() => vi.fn());
const useRevokeInvitationMock = vi.hoisted(() => vi.fn());
const useEntityCommunitiesMock = vi.hoisted(() => vi.fn());
const useOrgMembersMock = vi.hoisted(() => vi.fn());
const useInviteMock = vi.hoisted(() => vi.fn());
const useImportPeopleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/usePeople", () => ({ usePeople: usePeopleMock }));
vi.mock("@/hooks/useInvitations", () => ({ useInvitations: useInvitationsMock }));
vi.mock("@/hooks/useResendInvitation", () => ({ useResendInvitation: useResendInvitationMock }));
vi.mock("@/hooks/useRevokeInvitation", () => ({ useRevokeInvitation: useRevokeInvitationMock }));
vi.mock("@/hooks/useEntityCommunities", () => ({ useEntityCommunities: useEntityCommunitiesMock }));
vi.mock("@/hooks/useOrgMembers", () => ({ useOrgMembers: useOrgMembersMock }));
vi.mock("@/hooks/useInvite", () => ({ useInvite: useInviteMock }));
vi.mock("@/hooks/useImportPeople", () => ({ useImportPeople: useImportPeopleMock }));

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
  useInvitationsMock.mockReset();
  useResendInvitationMock.mockReset();
  useRevokeInvitationMock.mockReset();
  useEntityCommunitiesMock.mockReset();
  useOrgMembersMock.mockReset();
  useInviteMock.mockReset();
  useImportPeopleMock.mockReset();
});

/**
 * `useResendInvitation`/`useRevokeInvitation` se llaman siempre desde
 * `PersonasTable` (igual que `useDeleteResource` en `RecursosPanel`),
 * así que hace falta un valor por defecto en todos los tests; el resto
 * de hooks nuevos solo se montan cuando se abre el diálogo
 * correspondiente («Añadir persona» / «Importar Excel/CSV»).
 */
function mockDefaults() {
  useResendInvitationMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  });
  useRevokeInvitationMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  });
}

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadPersonasPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadPersonasPage", () => {
  it("muestra la fila de Ana con sus datos y enlaza a la ficha", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });

    await renderPage();

    expect(screen.getByRole("heading", { name: "Personas" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Ana" });
    expect(link).toHaveAttribute("href", "/entidad/alfaville/personas/42");
    expect(screen.getByText("Bea")).toBeInTheDocument();
    expect(screen.getByText("1/1/2025")).toBeInTheDocument();
  });

  it("sin referente muestra «Sin referente»", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({
      data: pageData({ results: [{ ...PERSON_ROW, referent: null }] }),
      isError: false,
      error: null,
    });

    await renderPage();

    expect(screen.getByText("Sin referente")).toBeInTheDocument();
  });

  it("escribir en los filtros llama a usePeople con la query exacta", async () => {
    mockDefaults();
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
    mockDefaults();
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
    mockDefaults();
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
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData({ count: 0, results: [] }), isError: false, error: null });

    await renderPage();

    expect(screen.getByText("Sin personas con estos filtros")).toBeInTheDocument();
  });

  it("estado de error pinta ErrorState", async () => {
    mockDefaults();
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

  // --- Tarea W3b: botones de gestión por rol ------------------------------

  it("titular ve «Añadir persona» e «Importar Excel/CSV»", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });

    await renderPage("titular");

    expect(screen.getByRole("button", { name: "Añadir persona" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar Excel/CSV" })).toBeInTheDocument();
  });

  it("moderador también ve los botones de gestión", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });

    await renderPage("moderador");

    expect(screen.getByRole("button", { name: "Añadir persona" })).toBeInTheDocument();
  });

  it("dinamizador no ve los botones de gestión ni acciones sobre invitadas", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({
      data: pageData({ results: [PERSON_ROW, buildInvitedPersonRow()] }),
      isError: false,
      error: null,
    });

    await renderPage("dinamizador");

    expect(screen.queryByRole("button", { name: "Añadir persona" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importar Excel/CSV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reenviar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revocar" })).not.toBeInTheDocument();
  });

  it("referente no ve los botones de gestión", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });

    await renderPage("referente");

    expect(screen.queryByRole("button", { name: "Añadir persona" })).not.toBeInTheDocument();
  });

  // --- «Añadir persona» ---------------------------------------------------

  it("«Añadir persona» manda el cuerpo esperado a la mutación", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "comm-1", name: "Paseos" })],
      isError: false,
      error: null,
    });
    useOrgMembersMock.mockReturnValue({
      data: [buildOrgMembershipFull({ user: 9, role: "referente" })],
      isError: false,
      error: null,
    });
    const mutate = vi.fn();
    useInviteMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null, reset: vi.fn() });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Añadir persona" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre"), "Carla");
    await user.type(within(dialog).getByLabelText("Email"), "carla@example.com");
    await user.type(within(dialog).getByLabelText("Teléfono"), "600999888");
    await user.selectOptions(within(dialog).getByLabelText("Comunidad"), "comm-1");
    await user.selectOptions(within(dialog).getByLabelText("Referente"), "9");
    await user.click(within(dialog).getByRole("button", { name: "Enviar invitación" }));

    expect(mutate).toHaveBeenCalledWith(
      {
        email: "carla@example.com",
        displayName: "Carla",
        phone: "600999888",
        community: "comm-1",
        referentUser: 9,
      },
      expect.anything(),
    );
  });

  it("«Añadir persona» valida el email antes de enviar", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useOrgMembersMock.mockReturnValue({ data: [], isError: false, error: null });
    const mutate = vi.fn();
    useInviteMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null, reset: vi.fn() });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Añadir persona" }));
    await user.type(screen.getByLabelText("Email"), "no-es-un-correo");
    await user.click(screen.getByRole("button", { name: "Enviar invitación" }));

    expect(screen.getByText("Introduce un correo válido.")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("«Añadir persona»: 409 muestra «Esta persona ya es miembro de la entidad»", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useOrgMembersMock.mockReturnValue({ data: [], isError: false, error: null });
    useInviteMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: { message: "Esta persona ya es miembro de la entidad." },
      reset: vi.fn(),
    });

    await renderPage("titular");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Añadir persona" }));

    expect(screen.getByText("Esta persona ya es miembro de la entidad.")).toBeInTheDocument();
  });

  it("«Añadir persona»: éxito muestra «Invitación enviada»", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useOrgMembersMock.mockReturnValue({ data: [], isError: false, error: null });
    const mutate = vi.fn((_input, options) => {
      options?.onSuccess?.();
    });
    useInviteMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null, reset: vi.fn() });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Añadir persona" }));
    await user.type(screen.getByLabelText("Email"), "carla@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar invitación" }));

    expect(screen.getByText(/Invitación enviada/)).toBeInTheDocument();
  });

  // --- Checkbox «Incluir invitadas» ---------------------------------------

  it("marcar «Incluir invitadas» llama a usePeople con includeInvited:true", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });
    useInvitationsMock.mockReturnValue({ data: [buildEntityInvitation()], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");
    usePeopleMock.mockClear();

    await user.click(screen.getByLabelText("Incluir invitadas"));

    const lastCall = usePeopleMock.mock.calls.at(-1);
    expect(lastCall?.[2]).toMatchObject({ includeInvited: true });
    expect(screen.getByText("1 invitación pendiente")).toBeInTheDocument();
  });

  it("con include_invited, la fila invitada muestra display_name, invited_at y acciones", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({
      data: pageData({ results: [PERSON_ROW, buildInvitedPersonRow({ display_name: "Carla" })] }),
      isError: false,
      error: null,
    });
    useInvitationsMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");
    await user.click(screen.getByLabelText("Incluir invitadas"));

    expect(screen.getByText("Invitada (pendiente)")).toBeInTheDocument();
    expect(screen.getByText("Carla")).toBeInTheDocument();
    expect(screen.getByText("4/9/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revocar" })).toBeInTheDocument();
  });

  it("«Reenviar» llama a la mutación con el invitation_id", async () => {
    const resendMutate = vi.fn();
    useResendInvitationMock.mockReturnValue({
      mutate: resendMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    useRevokeInvitationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
    usePeopleMock.mockReturnValue({
      data: pageData({ results: [buildInvitedPersonRow({ invitation_id: 5 })] }),
      isError: false,
      error: null,
    });
    useInvitationsMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");
    await user.click(screen.getByLabelText("Incluir invitadas"));
    await user.click(screen.getByRole("button", { name: "Reenviar" }));

    expect(resendMutate).toHaveBeenCalledWith(5);
  });

  it("«Revocar» pide confirmación antes de llamar a la mutación", async () => {
    const revokeMutate = vi.fn();
    useResendInvitationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
    useRevokeInvitationMock.mockReturnValue({
      mutate: revokeMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    usePeopleMock.mockReturnValue({
      data: pageData({ results: [buildInvitedPersonRow({ invitation_id: 5, display_name: "Carla" })] }),
      isError: false,
      error: null,
    });
    useInvitationsMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");
    await user.click(screen.getByLabelText("Incluir invitadas"));
    await user.click(screen.getByRole("button", { name: "Revocar" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(revokeMutate).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Revocar" }));

    expect(revokeMutate).toHaveBeenCalledWith(5, expect.anything());
  });

  it("dinamizador con include_invited ve la fila pero sin Reenviar/Revocar", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({
      data: pageData({ results: [buildInvitedPersonRow()] }),
      isError: false,
      error: null,
    });
    useInvitationsMock.mockReturnValue({ data: [], isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("dinamizador");
    await user.click(screen.getByLabelText("Incluir invitadas"));

    expect(screen.getByText("Invitada (pendiente)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reenviar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revocar" })).not.toBeInTheDocument();
  });

  // --- «Importar Excel/CSV» -----------------------------------------------

  it("importar: vista previa (dry_run) y confirmación son dos llamadas distintas", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });
    const previewResult = {
      created: 2,
      resent: 1,
      already_members: 1,
      errors: [{ row: 6, email: "x@example.com", error: "Correo duplicado en el fichero." }],
    };
    const confirmResult = { created: 2, resent: 1, already_members: 1, errors: [] };
    const mutate = vi.fn((input, options) => {
      options?.onSuccess?.(input.dryRun ? previewResult : confirmResult);
    });
    useImportPeopleMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Importar Excel/CSV" }));
    const file = new File(["nombre;email\nAna;ana@example.com"], "personas.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("Fichero (.xlsx o .csv)"), file);
    await user.click(screen.getByRole("button", { name: "Vista previa" }));

    expect(mutate).toHaveBeenNthCalledWith(1, { file, dryRun: true }, expect.anything());
    expect(screen.getByText("Correo duplicado en el fichero.")).toBeInTheDocument();
    expect(
      screen.getByText(/Las filas con error no se importarán/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar importación" }));

    expect(mutate).toHaveBeenNthCalledWith(2, { file, dryRun: false }, expect.anything());
    expect(screen.getByText("Importación confirmada.")).toBeInTheDocument();
  });

  it("importar: fichero que supera el límite de 5 MB muestra error y bloquea la vista previa", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });
    const mutate = vi.fn();
    useImportPeopleMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Importar Excel/CSV" }));
    const oversizedFile = new File([new Uint8Array(6 * 1024 * 1024)], "personas.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("Fichero (.xlsx o .csv)"), oversizedFile);

    expect(screen.getByText(/supera el límite de 5 MB/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vista previa" })).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("«Descargar plantilla» enlaza al CSV estático", async () => {
    mockDefaults();
    usePeopleMock.mockReturnValue({ data: pageData(), isError: false, error: null });
    useImportPeopleMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    });

    const user = userEvent.setup();
    await renderPage("titular");
    await user.click(screen.getByRole("button", { name: "Importar Excel/CSV" }));

    expect(screen.getByRole("link", { name: "Descargar plantilla" })).toHaveAttribute(
      "href",
      "/plantilla-personas.csv",
    );
  });
});
