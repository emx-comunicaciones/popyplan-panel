import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { buildAnnouncement } from "@/test-utils/fixtures/announcement";

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
