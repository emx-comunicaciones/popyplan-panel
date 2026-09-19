import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { buildAnnouncement } from "@/test-utils/fixtures/announcement";
import { buildEntityCommunityRow } from "@/test-utils/fixtures/community";

const useAnnouncementsMock = vi.hoisted(() => vi.fn());
const useSendAnnouncementMock = vi.hoisted(() => vi.fn());
const useEntityCommunitiesMock = vi.hoisted(() => vi.fn());

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

import { ComunicacionesPanel, describeAudience } from "./ComunicacionesPanel";

afterEach(() => {
  useAnnouncementsMock.mockReset();
  useSendAnnouncementMock.mockReset();
  useEntityCommunitiesMock.mockReset();
});

describe("ComunicacionesPanel", () => {
  it("si las comunidades fallan, lo avisa bajo la audiencia en vez de callar", () => {
    useAnnouncementsMock.mockReturnValue({ data: [], isError: false, error: null });
    useSendAnnouncementMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    });
    useEntityCommunitiesMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar las comunidades de la entidad."),
    });

    render(<ComunicacionesPanel orgId={7} canCompose />);

    expect(screen.getByText("No se pudieron cargar las comunidades.")).toBeInTheDocument();
    // Sin comunidades cargadas, la pista de «familias» sería engañosa.
    expect(
      screen.queryByText("Disponible cuando exista el espacio de familias."),
    ).not.toBeInTheDocument();
  });

  it("canCompose=false: solo muestra el historial, sin formulario", () => {
    useAnnouncementsMock.mockReturnValue({ data: [buildAnnouncement()], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });

    render(<ComunicacionesPanel orgId={7} canCompose={false} />);

    expect(screen.queryByRole("button", { name: "Enviar comunicación" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Solo titular o moderador pueden redactar comunicaciones/),
    ).toBeInTheDocument();
    expect(screen.getByText("Cerramos el jueves")).toBeInTheDocument();
  });

  it("historial vacío muestra el estado vacío", () => {
    useAnnouncementsMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useSendAnnouncementMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    render(<ComunicacionesPanel orgId={7} canCompose={false} />);

    expect(screen.getByText("Sin comunicaciones todavía")).toBeInTheDocument();
  });

  it("historial con error muestra ErrorState", () => {
    useAnnouncementsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar las comunicaciones."),
    });
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });

    render(<ComunicacionesPanel orgId={7} canCompose={false} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las comunicaciones");
  });

  it("sin comunidades de familias, 'Familias' está deshabilitada con la pista", () => {
    useAnnouncementsMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useSendAnnouncementMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    render(<ComunicacionesPanel orgId={7} canCompose />);

    expect(screen.getByRole("radio", { name: "Familias" })).toBeDisabled();
    expect(screen.getByText("Disponible cuando exista el espacio de familias.")).toBeInTheDocument();
  });

  it("sin comunidades de familias, el botón de plantilla no aparece", () => {
    useAnnouncementsMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
    useSendAnnouncementMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    render(<ComunicacionesPanel orgId={7} canCompose />);

    expect(
      screen.queryByRole("button", { name: "Usar plantilla: Bienvenida a la red de apoyo" }),
    ).not.toBeInTheDocument();
  });

  it("con comunidad de familias y el formulario vacío, la plantilla rellena título/cuerpo/audiencia sin confirmar", async () => {
    const user = userEvent.setup();
    useAnnouncementsMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c-1", name: "Familias", space: "families" })],
      isError: false,
      error: null,
    });
    useSendAnnouncementMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    render(<ComunicacionesPanel orgId={7} canCompose />);

    await user.click(screen.getByRole("button", { name: "Usar plantilla: Bienvenida a la red de apoyo" }));

    expect(screen.getByLabelText("Título")).toHaveValue("Bienvenida a la red de apoyo");
    expect(screen.getByLabelText("Cuerpo")).toHaveValue(
      "Gracias por acompañar a alguien de nuestra entidad. En este espacio de familias encontrarás actividades, formación y recursos pensados para ti. Recuerda: no verás las conversaciones, la actividad privada ni la ubicación de la persona a la que acompañas; solo lo que ella decida compartir con su red. Si necesitas hablar con la entidad, escribe a su referente desde la app.",
    );
    expect(screen.getByRole("radio", { name: "Familias" })).toBeChecked();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("con texto ya escrito, la plantilla pide confirmación y solo rellena tras confirmar", async () => {
    const user = userEvent.setup();
    useAnnouncementsMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c-1", name: "Familias", space: "families" })],
      isError: false,
      error: null,
    });
    useSendAnnouncementMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    render(<ComunicacionesPanel orgId={7} canCompose />);

    await user.type(screen.getByLabelText("Título"), "Borrador propio");
    await user.click(screen.getByRole("button", { name: "Usar plantilla: Bienvenida a la red de apoyo" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Usar la plantilla");
    expect(dialog).toHaveTextContent("Se reemplazará el texto actual del título y del cuerpo.");
    expect(screen.getByLabelText("Título")).toHaveValue("Borrador propio");

    await user.click(within(dialog).getByRole("button", { name: /usar/i }));

    expect(screen.getByLabelText("Título")).toHaveValue("Bienvenida a la red de apoyo");
    expect(screen.getByRole("radio", { name: "Familias" })).toBeChecked();
  });

  it("con una comunidad de familias, 'Familias' se puede elegir y enviar audience: 'families'", async () => {
    const user = userEvent.setup();
    useAnnouncementsMock.mockReturnValue({ data: [], isError: false, error: null });
    useEntityCommunitiesMock.mockReturnValue({
      data: [buildEntityCommunityRow({ id: "c-1", name: "Familias", space: "families" })],
      isError: false,
      error: null,
    });
    const mutate = vi.fn();
    useSendAnnouncementMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });

    render(<ComunicacionesPanel orgId={7} canCompose />);

    const familiasRadio = screen.getByRole("radio", { name: "Familias" });
    expect(familiasRadio).toBeEnabled();
    expect(
      screen.queryByText("Disponible cuando exista el espacio de familias."),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Título"), "Aviso familias");
    await user.type(screen.getByLabelText("Cuerpo"), "Contenido del aviso");
    await user.click(familiasRadio);
    await user.click(screen.getByRole("button", { name: "Enviar comunicación" }));
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(mutate).toHaveBeenCalledWith(
      { title: "Aviso familias", body: "Contenido del aviso", audience: "families" },
      expect.anything(),
    );
  });
});

describe("describeAudience", () => {
  it("'members' se describe como Todos los miembros", () => {
    expect(describeAudience("members", [])).toBe("Todos los miembros");
  });

  it("'families' se describe como Familias", () => {
    expect(describeAudience("families", [])).toBe("Familias");
  });

  it("'community:<uuid>' resuelve el nombre si la comunidad está en la lista", () => {
    const communities = [
      {
        id: "c-1",
        name: "Comunidad de costura",
      },
    ] as never;
    expect(describeAudience("community:c-1", communities)).toBe("Comunidad: Comunidad de costura");
  });

  it("'community:<uuid>' desconocida cae a un texto genérico", () => {
    expect(describeAudience("community:c-9", [])).toBe("Una comunidad");
  });
});
