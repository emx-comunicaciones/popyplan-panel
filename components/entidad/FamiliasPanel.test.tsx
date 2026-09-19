import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import {
  buildFamiliesSummary,
  buildFamiliesSummaryCommunityRow,
  buildFamilyAnnouncementRow,
  buildFamilyResourceRow,
  buildFamilyUpcomingEvent,
} from "@/test-utils/fixtures/families";

const useFamiliesSummaryMock = vi.hoisted(() => vi.fn());
const useToggleCrossSpaceMock = vi.hoisted(() => vi.fn());
const useCreateFamiliesCommunityMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useFamiliesSummary", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useFamiliesSummary")>(
    "@/hooks/useFamiliesSummary",
  );
  return { ...actual, useFamiliesSummary: useFamiliesSummaryMock };
});
vi.mock("@/hooks/useToggleCrossSpace", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useToggleCrossSpace")>(
    "@/hooks/useToggleCrossSpace",
  );
  return { ...actual, useToggleCrossSpace: useToggleCrossSpaceMock };
});
vi.mock("@/hooks/useCreateFamiliesCommunity", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCreateFamiliesCommunity")>(
    "@/hooks/useCreateFamiliesCommunity",
  );
  return { ...actual, useCreateFamiliesCommunity: useCreateFamiliesCommunityMock };
});

import { FamiliasPanel } from "./FamiliasPanel";

afterEach(() => {
  useFamiliesSummaryMock.mockReset();
  useToggleCrossSpaceMock.mockReset();
  useCreateFamiliesCommunityMock.mockReset();
});

function mockMutationDefaults() {
  useToggleCrossSpaceMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  });
  useCreateFamiliesCommunityMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  });
}

describe("FamiliasPanel", () => {
  it("cargando: muestra el mensaje de carga", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getByText("Cargando el espacio de Familias…")).toBeInTheDocument();
  });

  it("error: muestra ErrorState con el mensaje del hook", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudo cargar el resumen de Familias."),
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el resumen de Familias");
  });

  it("pinta el banner de separación de espacios siempre", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({ data: buildFamiliesSummary(), isError: false, error: null });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(
      screen.getByText(
        "Las comunidades de familias están separadas de las de miembros; nadie declara ser familiar de nadie.",
      ),
    ).toBeInTheDocument();
  });

  it("sin comunidades de familias: tarjetas a 0 y estado vacío", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [],
        members_count: 0,
        upcoming_events: [],
        announcements: [],
        resources: [],
      }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getByText("Sin comunidades de familias todavía")).toBeInTheDocument();
    expect(screen.getByText("Sin actividades próximas")).toBeInTheDocument();
    expect(screen.getByText("Sin comunicaciones para familias todavía")).toBeInTheDocument();
    expect(screen.getByText("Sin recursos para familias todavía")).toBeInTheDocument();
  });

  it("members_count suprimido (null) se pinta como '<5'", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        members_count: null,
        suppressed: true,
        communities: [
          buildFamiliesSummaryCommunityRow({ members_count: null, suppressed: true }),
        ],
      }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    const badges = screen.getAllByText("<5 personas");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("members_count null sin 'suppressed' explícito también se pinta como '<5'", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({ members_count: null }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getAllByText("<5").length).toBeGreaterThan(0);
  });

  it("lista comunidades, actividades, comunicaciones y recursos con enlaces a sus secciones", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [buildFamiliesSummaryCommunityRow({ name: "Familias Alfaville" })],
        upcoming_events: [buildFamilyUpcomingEvent({ title: "Merienda familiar" })],
        announcements: [buildFamilyAnnouncementRow({ title: "Aviso familias" })],
        resources: [buildFamilyResourceRow({ title: "Guía familias" })],
      }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getByText("Familias Alfaville")).toBeInTheDocument();
    expect(screen.getByText("Merienda familiar")).toBeInTheDocument();
    expect(screen.getByText("Aviso familias")).toBeInTheDocument();
    expect(screen.getByText("Guía familias")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a Comunicaciones" })).toHaveAttribute(
      "href",
      "/entidad/alfaville/comunicaciones",
    );
    expect(screen.getByRole("link", { name: "Ir a Recursos" })).toHaveAttribute(
      "href",
      "/entidad/alfaville/biblioteca",
    );
    expect(screen.getByRole("link", { name: "Ver todas las actividades" })).toHaveAttribute(
      "href",
      "/entidad/alfaville/actividades",
    );
  });

  it("canManage=false: no ve el interruptor de cruce ni «Nueva comunidad de familias»", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [buildFamiliesSummaryCommunityRow({ name: "Familias Alfaville" })],
      }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage={false} />);

    expect(screen.queryByRole("checkbox", { name: "Permitir cruce de espacios" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nueva comunidad de familias" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Espacios separados")).toBeInTheDocument();
  });

  it("canManage=true: activar el cruce pide confirmación y llama a mutate con el body correcto", async () => {
    const mutate = vi.fn();
    useToggleCrossSpaceMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });
    useCreateFamiliesCommunityMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [
          buildFamiliesSummaryCommunityRow({
            id: "c-1",
            name: "Familias Alfaville",
            allow_cross_space: false,
          }),
        ],
      }),
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    await user.click(screen.getByRole("checkbox", { name: "Permitir cruce de espacios" }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/rompiendo la separación por defecto/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(mutate).toHaveBeenCalledWith(
      { orgId: 7, communityId: "c-1", allowCrossSpace: true },
      expect.anything(),
    );
  });

  it("cancelar la confirmación no llama a mutate", async () => {
    const mutate = vi.fn();
    useToggleCrossSpaceMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });
    useCreateFamiliesCommunityMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [buildFamiliesSummaryCommunityRow({ id: "c-1", allow_cross_space: false })],
      }),
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    await user.click(screen.getByRole("checkbox", { name: "Permitir cruce de espacios" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("«Nueva comunidad de familias» crea con space:'families' vía el formulario", async () => {
    const mutate = vi.fn();
    mockMutationDefaults();
    useCreateFamiliesCommunityMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    });
    useFamiliesSummaryMock.mockReturnValue({ data: buildFamiliesSummary(), isError: false, error: null });

    const user = userEvent.setup();
    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    await user.click(screen.getByRole("button", { name: "Nueva comunidad de familias" }));
    await user.type(screen.getByLabelText("Nombre"), "Familias del barrio");
    await user.type(screen.getByLabelText("Descripción"), "Espacio para familias");
    await user.click(screen.getByRole("button", { name: "Crear comunidad" }));

    expect(mutate).toHaveBeenCalledWith(
      {
        orgId: 7,
        name: "Familias del barrio",
        description: "Espacio para familias",
        visibility: "open",
        codeOfConduct: undefined,
      },
      expect.anything(),
    );
  });

  it("«Nueva comunidad de familias» con detalle del backend (400) muestra ese texto tal cual", async () => {
    const { CreateFamiliesCommunityError } = await import("@/hooks/useCreateFamiliesCommunity");
    useToggleCrossSpaceMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
    useCreateFamiliesCommunityMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new CreateFamiliesCommunityError(
        "invalido",
        "Ya existe una comunidad de familias en esta entidad.",
        "Ya existe una comunidad de familias en esta entidad.",
      ),
    });
    useFamiliesSummaryMock.mockReturnValue({ data: buildFamiliesSummary(), isError: false, error: null });

    const user = userEvent.setup();
    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    await user.click(screen.getByRole("button", { name: "Nueva comunidad de familias" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ya existe una comunidad de familias en esta entidad.",
    );
  });

  it("tarjetas de la red de apoyo: pintan value/suppressed con formatCount", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        people_with_support_network: { value: 7, suppressed: false },
        active_supporters: { value: null, suppressed: true },
        supporters_notified_on_help: { value: 3, suppressed: false },
      }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getByText("Personas con red de apoyo")).toBeInTheDocument();
    expect(screen.getByText("Apoyos activos")).toBeInTheDocument();
    expect(screen.getByText("Apoyos que reciben avisos")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("<5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("sin comunidades y apoyos pendientes (>1): aviso en plural con el botón de crear", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [],
        missing_families_space_supporters: 3,
      }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "3 personas de la red de apoyo esperan a que crees la comunidad de familias.",
    );
    expect(screen.getByRole("button", { name: "Nueva comunidad de familias" })).toBeInTheDocument();
  });

  it("sin comunidades y un solo apoyo pendiente: aviso en singular", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [],
        missing_families_space_supporters: 1,
      }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "1 persona de la red de apoyo espera a que crees la comunidad de familias.",
    );
  });

  it("sin comunidades, apoyos pendientes y canManage=false: aviso sin el botón de crear", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [],
        missing_families_space_supporters: 2,
      }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage={false} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "2 personas de la red de apoyo esperan a que crees la comunidad de familias.",
    );
    expect(
      screen.queryByRole("button", { name: "Nueva comunidad de familias" }),
    ).not.toBeInTheDocument();
  });

  it("con comunidades y apoyos pendientes: aviso de alta automática, sin botón nuevo", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [buildFamiliesSummaryCommunityRow({ name: "Familias Alfaville" })],
        missing_families_space_supporters: 4,
      }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "El alta en la comunidad de familias se completará automáticamente.",
    );
    // Un único botón «Nueva comunidad de familias» (el de gestión habitual, no uno duplicado por el aviso).
    expect(screen.getAllByRole("button", { name: "Nueva comunidad de familias" })).toHaveLength(1);
  });

  it("sin apoyos pendientes (0): no pinta ningún aviso", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [],
        missing_families_space_supporters: 0,
      }),
      isError: false,
      error: null,
    });

    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("nunca lista nombres de apoyos en el árbol", () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [],
        missing_families_space_supporters: 1,
      }),
      isError: false,
      error: null,
    });

    const { container } = render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    expect(container).not.toHaveTextContent("supporter");
    expect(container).not.toHaveTextContent("public_name");
  });

  it("con el alta en vuelo, Escape no cierra el diálogo y «Cancelar» está deshabilitado", async () => {
    mockMutationDefaults();
    useCreateFamiliesCommunityMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
      reset: vi.fn(),
    });
    useFamiliesSummaryMock.mockReturnValue({ data: buildFamiliesSummary(), isError: false, error: null });

    const user = userEvent.setup();
    render(<FamiliasPanel orgId={7} slug="alfaville" canManage />);

    await user.click(screen.getByRole("button", { name: "Nueva comunidad de familias" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
