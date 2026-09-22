import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "@/test-utils/axe";
import { render, screen, within } from "@/test-utils/render";

const useEntityEventsMock = vi.hoisted(() => vi.fn());
const useCreateEventMock = vi.hoisted(() => vi.fn());
const useUpdateEventMock = vi.hoisted(() => vi.fn());
const useCancelEventMock = vi.hoisted(() => vi.fn());
const useEntityCommunitiesMock = vi.hoisted(() => vi.fn());
const useSearchPlacesMock = vi.hoisted(() => vi.fn());
const useEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useEntityEvents", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useEntityEvents")>(
    "@/hooks/useEntityEvents",
  );
  return { ...actual, useEntityEvents: useEntityEventsMock };
});
vi.mock("@/hooks/useEventMutations", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useEventMutations")>(
    "@/hooks/useEventMutations",
  );
  return {
    ...actual,
    useCreateEvent: useCreateEventMock,
    useUpdateEvent: useUpdateEventMock,
    useCancelEvent: useCancelEventMock,
  };
});
vi.mock("@/hooks/useEntityCommunities", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useEntityCommunities")>(
    "@/hooks/useEntityCommunities",
  );
  return { ...actual, useEntityCommunities: useEntityCommunitiesMock };
});
vi.mock("@/hooks/usePlaces", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePlaces")>("@/hooks/usePlaces");
  return { ...actual, useSearchPlaces: useSearchPlacesMock };
});
vi.mock("@/hooks/useEvent", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useEvent")>("@/hooks/useEvent");
  return { ...actual, useEvent: useEventMock };
});

import { ActividadesTable } from "./ActividadesTable";

const EVENT_ROW = {
  id: "e1",
  title: "Salida al monte",
  starts_at: "2026-01-08T18:00:00Z",
  status: "scheduled",
  audience: "anyone",
  community: null,
  organizer: { user_id: 1, public_name: "Titular" },
  capacity: null,
  registered: 1,
  attended: 0,
  no_show: 0,
};

const EVENT_DETAIL = {
  id: "e1",
  title: "Salida al monte",
  description: "Una ruta guiada",
  starts_at: "2026-01-08T18:00:00.000Z",
  ends_at: null,
  audience: "anyone",
  status: "scheduled",
  latitude: null,
  longitude: null,
  place: null,
  capacity: null,
  community: null,
};

function mutationDefaults(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn(), ...overrides };
}

afterEach(() => {
  useEntityEventsMock.mockReset();
  useCreateEventMock.mockReset();
  useUpdateEventMock.mockReset();
  useCancelEventMock.mockReset();
  useEntityCommunitiesMock.mockReset();
  useSearchPlacesMock.mockReset();
  useEventMock.mockReset();
});

function setDefaults() {
  useEntityEventsMock.mockReturnValue({ data: [EVENT_ROW], isError: false, error: null });
  useCreateEventMock.mockReturnValue(mutationDefaults());
  useUpdateEventMock.mockReturnValue(mutationDefaults());
  useCancelEventMock.mockReturnValue(mutationDefaults());
  useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
  useSearchPlacesMock.mockReturnValue({ data: [], isError: false, error: null });
  useEventMock.mockReturnValue({ data: EVENT_DETAIL, isError: false, error: null });
}

describe("ActividadesTable — gestión de actividades", () => {
  it("canManage=false: no muestra «Nueva actividad» ni acciones por fila", () => {
    setDefaults();
    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage={false} />);

    expect(screen.queryByRole("button", { name: "Nueva actividad" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar actividad" })).not.toBeInTheDocument();
  });

  it("canManage=true: muestra «Nueva actividad» y, por fila, «Editar»/«Cancelar actividad»", () => {
    setDefaults();
    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);

    expect(screen.getByRole("button", { name: "Nueva actividad" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar actividad" })).toBeInTheDocument();
  });

  it("una actividad ya cancelada no ofrece «Cancelar actividad»", () => {
    setDefaults();
    useEntityEventsMock.mockReturnValue({
      data: [{ ...EVENT_ROW, status: "cancelled" }],
      isError: false,
      error: null,
    });

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);

    expect(screen.queryByRole("button", { name: "Cancelar actividad" })).not.toBeInTheDocument();
    // Sí se puede seguir editando (p. ej. corregir el título).
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("«Nueva actividad» abre el diálogo y crear manda el payload esperado", async () => {
    setDefaults();
    const createMutate = vi.fn();
    useCreateEventMock.mockReturnValue(mutationDefaults({ mutate: createMutate }));
    const user = userEvent.setup();

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Nueva actividad" }));

    const dialog = screen.getByRole("dialog", { name: "Nueva actividad" });
    await user.type(within(dialog).getByLabelText("Título"), "Ruta en bici");
    await user.type(within(dialog).getByLabelText("Empieza"), "2027-01-01T10:00");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    expect(createMutate).toHaveBeenCalledTimes(1);
    const [fields] = createMutate.mock.calls[0];
    expect(fields.title).toBe("Ruta en bici");
    expect(fields.audience).toBe("anyone");
    expect(fields.community).toBeNull();
  });

  it("«Editar» carga el detalle real y precarga el formulario", async () => {
    setDefaults();
    const user = userEvent.setup();

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Editar" }));

    const dialog = screen.getByRole("dialog", { name: "Editar actividad" });
    expect(within(dialog).getByLabelText("Título")).toHaveValue("Salida al monte");
    // Al editar, audiencia/comunidad se pintan de solo lectura (el backend
    // no admite cambiarlas en un PATCH).
    expect(within(dialog).queryByLabelText("Quién se puede apuntar")).not.toBeInTheDocument();
  });

  it("«Cancelar actividad» pide confirmación antes de llamar a la mutación", async () => {
    setDefaults();
    const cancelMutate = vi.fn();
    useCancelEventMock.mockReturnValue(mutationDefaults({ mutate: cancelMutate }));
    const user = userEvent.setup();

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Cancelar actividad" }));

    expect(cancelMutate).not.toHaveBeenCalled();
    const confirmDialog = screen.getByRole("alertdialog");
    expect(within(confirmDialog).getByText(/Salida al monte/)).toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole("button", { name: "Cancelar actividad" }));
    expect(cancelMutate).toHaveBeenCalledWith("e1", expect.anything());
  });

  it("el error de cancelar se pinta dentro del ConfirmDialog", async () => {
    setDefaults();
    useCancelEventMock.mockReturnValue(
      mutationDefaults({
        isError: true,
        error: { kind: "sin_permiso", message: "No tienes permiso para gestionar esta actividad." },
      }),
    );
    const user = userEvent.setup();

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Cancelar actividad" }));

    expect(screen.getByRole("alert")).toHaveTextContent("No tienes permiso para gestionar esta actividad.");
  });

  it("axe: sin violaciones de accesibilidad con el diálogo de creación abierto", async () => {
    setDefaults();
    const user = userEvent.setup();

    const { container } = render(
      <ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />,
    );
    await user.click(screen.getByRole("button", { name: "Nueva actividad" }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
