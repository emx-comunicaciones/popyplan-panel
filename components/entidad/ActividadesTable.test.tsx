import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "@/test-utils/axe";
import { waitFor } from "@testing-library/react";

import { render, screen, within } from "@/test-utils/render";

const useEntityEventsMock = vi.hoisted(() => vi.fn());
const useCreateEventMock = vi.hoisted(() => vi.fn());
const useUpdateEventMock = vi.hoisted(() => vi.fn());
const useCancelEventMock = vi.hoisted(() => vi.fn());
const useEntityCommunitiesMock = vi.hoisted(() => vi.fn());
const useSearchPlacesMock = vi.hoisted(() => vi.fn());
const useEventMock = vi.hoisted(() => vi.fn());
const useCatalogMock = vi.hoisted(() => vi.fn());

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
vi.mock("@/hooks/useCatalogs", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCatalogs")>("@/hooks/useCatalogs");
  return { ...actual, useCatalog: useCatalogMock };
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
  suppressed: false,
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
  category: null,
  custom_category: "",
  estimated_cost: null,
  min_age: null,
  max_age: null,
  is_trip: false,
  stops: [],
};

function catalogItem(id: string, label: string, categoryType: string, isActive = true) {
  return {
    id,
    label,
    code: null,
    order: null,
    emoji: null,
    parent: null,
    categoryType,
    description: null,
    icon: null,
    count: null,
    isActive,
  };
}

const EVENT_CATEGORIES = [
  catalogItem("3", "Deporte", "sports"),
  catalogItem("5", "Viajes", "travel"),
  catalogItem("9", "Antigua", "other", false),
];

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
  useCatalogMock.mockReset();
});

function setDefaults() {
  useEntityEventsMock.mockReturnValue({ data: [EVENT_ROW], isError: false, error: null });
  useCreateEventMock.mockReturnValue(mutationDefaults());
  useUpdateEventMock.mockReturnValue(mutationDefaults());
  useCancelEventMock.mockReturnValue(mutationDefaults());
  useEntityCommunitiesMock.mockReturnValue({ data: [], isError: false, error: null });
  useSearchPlacesMock.mockReturnValue({ data: [], isError: false, error: null });
  useEventMock.mockReturnValue({ data: EVENT_DETAIL, isError: false, error: null });
  useCatalogMock.mockReturnValue({ data: EVENT_CATEGORIES, isError: false, error: null });
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

  it("sin lista nominal, los contadores por debajo del umbral salen «<5», nunca vacíos (S-07)", () => {
    setDefaults();
    useEntityEventsMock.mockReturnValue({
      data: [{ ...EVENT_ROW, registered: null, attended: null, no_show: null, suppressed: true }],
      isError: false,
      error: null,
    });

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance={false} canManage={false} />);

    const fila = screen.getByText("Salida al monte").closest("tr");
    expect(fila).not.toBeNull();
    expect(within(fila as HTMLElement).getAllByText("<5")).toHaveLength(3);
  });

  it("con lista nominal, los contadores salen tal cual, también los ceros", () => {
    setDefaults();
    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage={false} />);

    const fila = screen.getByText("Salida al monte").closest("tr");
    const celdas = within(fila as HTMLElement).getAllByRole("cell").map((c) => c.textContent);
    expect(celdas).toEqual(expect.arrayContaining(["1", "0", "0"]));
    expect(within(fila as HTMLElement).queryByText("<5")).not.toBeInTheDocument();
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

  it("tras crear una actividad futura, el periodo se amplía para que se vea", async () => {
    // Una actividad nueva es **siempre** futura (el backend exige
    // `starts_at` en el futuro) y el periodo arranca en «Este mes», que
    // llega hasta hoy: sin ampliarlo, la actividad se creaba y
    // desaparecía de esta misma pantalla. Auditoría del panel, 2026-09-24.
    setDefaults();
    const createMutate = vi.fn((_fields, opciones) => opciones?.onSuccess?.());
    useCreateEventMock.mockReturnValue(mutationDefaults({ mutate: createMutate }));
    const user = userEvent.setup();

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Nueva actividad" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva actividad" });
    await user.type(within(dialog).getByLabelText("Título"), "Ruta en bici");
    await user.type(within(dialog).getByLabelText("Empieza"), "2027-01-01T10:00");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    // La última llamada al hook de listado ya pide un periodo que llega a
    // 2027-01-01: es lo que hace visible la fila recién creada.
    await waitFor(() => {
      const [, periodo] = useEntityEventsMock.mock.calls.at(-1)!;
      expect(periodo.until >= "2027-01-01").toBe(true);
    });
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

  it("crear: el nivel es opcional y arranca en «Todos los niveles»", async () => {
    setDefaults();
    const createMutate = vi.fn();
    useCreateEventMock.mockReturnValue(mutationDefaults({ mutate: createMutate }));
    const user = userEvent.setup();

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Nueva actividad" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva actividad" });
    const level = within(dialog).getByLabelText("Nivel");
    expect(level).toHaveValue("");
    expect(within(level).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Todos los niveles",
      "Principiante",
      "Intermedio",
      "Avanzado",
    ]);

    await user.type(within(dialog).getByLabelText("Título"), "Iniciación al pádel");
    await user.type(within(dialog).getByLabelText("Empieza"), "2027-01-01T10:00");
    await user.selectOptions(level, "beginner");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    expect(createMutate.mock.calls[0][0].level).toBe("beginner");
  });

  it("editar: precarga el nivel y solo lo manda si cambia", async () => {
    setDefaults();
    useEventMock.mockReturnValue({ data: { ...EVENT_DETAIL, level: "advanced" }, isError: false, error: null });
    const updateMutate = vi.fn();
    useUpdateEventMock.mockReturnValue(mutationDefaults({ mutate: updateMutate }));
    const user = userEvent.setup();

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar actividad" });
    expect(within(dialog).getByLabelText("Nivel")).toHaveValue("advanced");

    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(updateMutate.mock.calls[0][0]).not.toHaveProperty("level");

    await user.selectOptions(within(dialog).getByLabelText("Nivel"), "");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(updateMutate.mock.calls[1][0].level).toBe("");
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

  it("arranca en «Este mes y próximos»: el periodo llega por delante de hoy (informe, error 10)", () => {
    setDefaults();
    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);

    const [, periodo] = useEntityEventsMock.mock.calls[0];
    const hoy = new Date();
    const dentroDeUnaSemana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 7);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(periodo.until >= iso(dentroDeUnaSemana)).toBe(true);
    expect(screen.getByRole("button", { name: "Este mes y próximos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("mientras se cancela, el botón de confirmar está deshabilitado y no lanza otra petición", async () => {
    setDefaults();
    const cancelMutate = vi.fn();
    useCancelEventMock.mockReturnValue(mutationDefaults({ mutate: cancelMutate, isPending: true }));
    const user = userEvent.setup();

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Cancelar actividad" }));
    const confirmar = within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar actividad" });
    expect(confirmar).toBeDisabled();
    await user.dblClick(confirmar);
    expect(cancelMutate).not.toHaveBeenCalled();
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

describe("ActividadesTable — categoría, coste, edades y viajes (como en la app)", () => {
  async function abrirNueva() {
    const user = userEvent.setup();
    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Nueva actividad" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva actividad" });
    await user.type(within(dialog).getByLabelText("Título"), "Quedada");
    return { user, dialog };
  }

  it("la categoría ofrece las activas del catálogo y «Otra», que exige escribirla", async () => {
    setDefaults();
    const createMutate = vi.fn();
    useCreateEventMock.mockReturnValue(mutationDefaults({ mutate: createMutate }));
    const { user, dialog } = await abrirNueva();
    await user.type(within(dialog).getByLabelText("Empieza"), "2027-01-01T10:00");

    const categoria = within(dialog).getByLabelText("Categoría");
    expect(within(categoria).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Sin categoría",
      "Deporte",
      "Viajes",
      "Otra (escríbela tú)",
    ]);

    await user.selectOptions(categoria, "other");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Escribe la actividad (máx. 60 caracteres).");
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Actividad concreta"), "  Juegos   de mesa ");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    const [fields] = createMutate.mock.calls[0];
    expect(fields.category).toBeNull();
    expect(fields.custom_category).toBe("Juegos de mesa");
    expect(fields).not.toHaveProperty("stops");
  });

  it("coste y edades: se validan y viajan en el formato del backend", async () => {
    setDefaults();
    const createMutate = vi.fn();
    useCreateEventMock.mockReturnValue(mutationDefaults({ mutate: createMutate }));
    const { user, dialog } = await abrirNueva();
    await user.type(within(dialog).getByLabelText("Empieza"), "2027-01-01T10:00");
    await user.selectOptions(within(dialog).getByLabelText("Categoría"), "3");

    await user.click(within(dialog).getByLabelText("Tiene coste"));
    await user.type(within(dialog).getByLabelText("Coste aproximado por persona (€)"), "12,5");
    await user.type(within(dialog).getByLabelText("Edad mínima"), "40");
    await user.type(within(dialog).getByLabelText("Edad máxima"), "30");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "La edad mínima no puede ser mayor que la máxima.",
    );
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();

    await user.clear(within(dialog).getByLabelText("Edad máxima"));
    await user.type(within(dialog).getByLabelText("Edad máxima"), "65");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    const [fields] = createMutate.mock.calls[0];
    expect(fields).toMatchObject({
      category: 3,
      custom_category: "",
      estimated_cost: "12.50",
      min_age: 40,
      max_age: 65,
    });
  });

  it("un viaje va por días, exige el día final y manda sus paradas en orden", async () => {
    setDefaults();
    const createMutate = vi.fn();
    useCreateEventMock.mockReturnValue(mutationDefaults({ mutate: createMutate }));
    const { user, dialog } = await abrirNueva();

    await user.selectOptions(within(dialog).getByLabelText("Categoría"), "5");
    expect(within(dialog).queryByLabelText("Empieza")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Día de inicio"), "2027-03-10");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Un viaje necesita un día final.");
    await user.type(within(dialog).getByLabelText("Día final"), "2027-03-12");

    expect(within(dialog).getByText("Todavía no hay paradas.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Añadir parada" }));
    await user.click(within(dialog).getByRole("button", { name: "Añadir parada" }));
    // Una parada sin nombre no deja guardar.
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Nombre de la parada 1"), "Burgos");
    await user.type(within(dialog).getByLabelText("Nombre de la parada 2"), "León");
    await user.type(within(dialog).getByLabelText("Dirección de la parada 2 (opcional)"), "Plaza Mayor");
    await user.click(within(dialog).getByRole("button", { name: "Subir la parada 2" }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    const [fields] = createMutate.mock.calls[0];
    expect(fields.category).toBe(5);
    expect(new Date(fields.starts_at).getTime()).toBe(new Date(2027, 2, 10, 0, 0, 0).getTime());
    expect(new Date(fields.ends_at).getTime()).toBe(new Date(2027, 2, 12, 23, 59, 59).getTime());
    expect(fields.stops).toEqual([
      { name: "León", address: "Plaza Mayor" },
      { name: "Burgos", address: "" },
    ]);
  });

  it("editar un viaje: precarga todo y conserva id y coordenadas de las paradas", async () => {
    setDefaults();
    const startsAt = new Date(2027, 2, 10, 0, 0, 0).toISOString();
    const endsAt = new Date(2027, 2, 12, 23, 59, 59).toISOString();
    useEventMock.mockReturnValue({
      data: {
        ...EVENT_DETAIL,
        starts_at: startsAt,
        ends_at: endsAt,
        category: { id: "5", name: "Viajes" },
        custom_category: "Ruta del Cid",
        estimated_cost: "150.00",
        min_age: 18,
        max_age: null,
        is_trip: true,
        stops: [
          { id: "s1", order: 0, name: "Burgos", latitude: "42.343000", longitude: "-3.696000", address: "" },
        ],
      },
      isError: false,
      error: null,
    });
    const updateMutate = vi.fn();
    useUpdateEventMock.mockReturnValue(mutationDefaults({ mutate: updateMutate }));
    const user = userEvent.setup();

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar actividad" });
    expect(within(dialog).getByLabelText("Categoría")).toHaveValue("5");
    expect(within(dialog).getByLabelText("Actividad concreta")).toHaveValue("Ruta del Cid");
    expect(within(dialog).getByLabelText("Tiene coste")).toBeChecked();
    expect(within(dialog).getByLabelText("Coste aproximado por persona (€)")).toHaveValue("150.00");
    expect(within(dialog).getByLabelText("Edad mínima")).toHaveValue(18);
    expect(within(dialog).getByLabelText("Día de inicio")).toHaveValue("2027-03-10");
    expect(within(dialog).getByLabelText("Nombre de la parada 1")).toHaveValue("Burgos");

    await user.click(within(dialog).getByLabelText("Tiene coste"));
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    const [fields] = updateMutate.mock.calls[0];
    // Los días no cambiaron: no se reenvía el inicio y el final sale igual.
    expect(fields).not.toHaveProperty("starts_at");
    expect(fields.ends_at).toBe(endsAt);
    expect(fields).toMatchObject({
      category: 5,
      custom_category: "Ruta del Cid",
      estimated_cost: null,
      min_age: 18,
      max_age: null,
      stops: [{ id: "s1", name: "Burgos", address: "", latitude: "42.343000", longitude: "-3.696000" }],
    });
  });

  it("editar algo que no es viaje: manda los campos vacíos para quitarlos y nunca paradas", async () => {
    setDefaults();
    const updateMutate = vi.fn();
    useUpdateEventMock.mockReturnValue(mutationDefaults({ mutate: updateMutate }));
    const user = userEvent.setup();

    render(<ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />);
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar actividad" });
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    const [fields] = updateMutate.mock.calls[0];
    expect(fields).toMatchObject({
      category: null,
      custom_category: "",
      estimated_cost: null,
      min_age: null,
      max_age: null,
    });
    expect(fields).not.toHaveProperty("stops");
  });

  it("mientras carga el catálogo, la categoría no se puede elegir (solo habría «Otra»)", async () => {
    setDefaults();
    useCatalogMock.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null });
    const { dialog } = await abrirNueva();
    const categoria = within(dialog).getByLabelText("Categoría");
    expect(categoria).toBeDisabled();
    expect(within(categoria).getAllByRole("option")[0]).toHaveTextContent("Cargando categorías…");
  });

  it("si el catálogo de categorías falla, lo avisa", async () => {
    setDefaults();
    useCatalogMock.mockReturnValue({ data: undefined, isError: true, error: new Error("x") });
    const { dialog } = await abrirNueva();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("No se pudieron cargar las categorías.");
  });

  it("axe: sin violaciones con un viaje y sus paradas", async () => {
    setDefaults();
    const user = userEvent.setup();
    const { container } = render(
      <ActividadesTable orgId={7} slug="alfaville" canOpenAttendance canManage />,
    );
    await user.click(screen.getByRole("button", { name: "Nueva actividad" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva actividad" });
    await user.selectOptions(within(dialog).getByLabelText("Categoría"), "5");
    await user.click(within(dialog).getByRole("button", { name: "Añadir parada" }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
