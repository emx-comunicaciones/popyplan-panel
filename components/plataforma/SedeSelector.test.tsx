import userEvent from "@testing-library/user-event";
import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { buildPlaceRow } from "@/test-utils/fixtures/places";

const useSearchPlacesMock = vi.hoisted(() => vi.fn());
const usePlacesByIneMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/usePlaces", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePlaces")>("@/hooks/usePlaces");
  return { ...actual, useSearchPlaces: useSearchPlacesMock, usePlacesByIne: usePlacesByIneMock };
});

import { SedeSelector } from "./SedeSelector";

// Los campos con retardo se prueban con `fireEvent.change` +
// `vi.advanceTimersByTime`, nunca con `userEvent` y temporizadores
// falsos: `userEvent` se cuelga en esta suite (ver CLAUDE.md,
// «Buscadores con retardo»).
afterEach(() => {
  vi.useRealTimers();
  useSearchPlacesMock.mockReset();
  usePlacesByIneMock.mockReset();
});

/** Por defecto, sin código guardado: `usePlacesByIne([])` está deshabilitada. */
function mockEmptyCurrentPlace() {
  usePlacesByIneMock.mockReturnValue({ data: undefined, isPending: true, isError: false });
}

describe("SedeSelector", () => {
  it("busca municipios con retardo y ofrece los resultados", () => {
    vi.useFakeTimers();
    useSearchPlacesMock.mockReturnValue({ data: [buildPlaceRow()], isError: false, error: null });
    mockEmptyCurrentPlace();

    render(<SedeSelector id="sede" value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Buscar un municipio"), { target: { value: "irun" } });
    act(() => vi.advanceTimersByTime(300));

    expect(useSearchPlacesMock).toHaveBeenLastCalledWith("irun");
    expect(screen.getByRole("option", { name: "Irun (Gipuzkoa) · 20069" })).toBeInTheDocument();
  });

  it("elegir un municipio devuelve su código INE", async () => {
    const onChange = vi.fn();
    useSearchPlacesMock.mockReturnValue({ data: [buildPlaceRow()], isError: false, error: null });
    mockEmptyCurrentPlace();

    render(<SedeSelector id="sede" value={null} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Municipio de la sede"), "20069");

    expect(onChange).toHaveBeenCalledWith("20069");
  });

  /**
   * I5 de la revisión final de rama: la sede es obligatoria en alta y en
   * edición (spec §2.1); «Sin municipio» dejó de ofrecerse como opción
   * del `<select>` (solo se lee en la ficha, para una organización
   * antigua sin sede) y el control lleva `aria-required`.
   */
  it("no ofrece «Sin municipio»: la sede es obligatoria en alta y en edición (I5)", () => {
    useSearchPlacesMock.mockReturnValue({ data: [buildPlaceRow()], isError: false, error: null });
    mockEmptyCurrentPlace();

    render(<SedeSelector id="sede" value="20069" onChange={vi.fn()} />);

    expect(screen.queryByRole("option", { name: "Sin municipio" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Municipio de la sede")).toHaveAttribute("aria-required", "true");
  });

  it("liga el `<select>` al párrafo de ayuda del consumidor cuando se pasa `hintId` (I5)", () => {
    useSearchPlacesMock.mockReturnValue({ data: [], isError: false, error: null });
    mockEmptyCurrentPlace();

    render(<SedeSelector id="sede" value={null} onChange={vi.fn()} hintId="sede-hint" />);

    expect(screen.getByLabelText("Municipio de la sede")).toHaveAttribute(
      "aria-describedby",
      "sede-hint",
    );
  });

  it("liga el `<select>` a la vez al párrafo de ayuda y al de error, cuando los dos están presentes", () => {
    useSearchPlacesMock.mockReturnValue({ data: undefined, isError: true, error: { kind: "desconocido" } });
    mockEmptyCurrentPlace();

    render(<SedeSelector id="sede" value={null} onChange={vi.fn()} hintId="sede-hint" />);

    const describedBy = screen.getByLabelText("Municipio de la sede").getAttribute("aria-describedby");
    expect(describedBy).toContain("sede-hint");
    expect(screen.getByRole("alert")).toHaveAttribute("id", expect.stringMatching(/./));
  });

  /**
   * I1 de la revisión final de rama: el valor ya guardado, cuando la
   * búsqueda en curso no lo devuelve, se resolvía como
   * «Municipio actual (INE 20069)» — un código crudo. Ahora se resuelve
   * con `usePlacesByIne` y se pinta «Irun (Gipuzkoa)», igual que en
   * `EntidadDetail`/`EntidadesTable`.
   */
  it("el valor ya guardado se resuelve a nombre + provincia cuando la búsqueda no lo devuelve (I1)", () => {
    useSearchPlacesMock.mockReturnValue({ data: [], isError: false, error: null });
    usePlacesByIneMock.mockReturnValue({ data: [buildPlaceRow()], isPending: false, isError: false });

    render(<SedeSelector id="sede" value="20069" onChange={vi.fn()} />);

    expect(screen.getByLabelText("Municipio de la sede")).toHaveValue("20069");
    expect(screen.getByText("Irun (Gipuzkoa)")).toBeInTheDocument();
    expect(screen.queryByText("Municipio actual (INE 20069)")).not.toBeInTheDocument();
  });

  it("mientras se resuelve el valor guardado, la opción dice «…» (I1)", () => {
    useSearchPlacesMock.mockReturnValue({ data: [], isError: false, error: null });
    usePlacesByIneMock.mockReturnValue({ data: undefined, isPending: true, isError: false });

    render(<SedeSelector id="sede" value="20069" onChange={vi.fn()} />);

    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("si la resolución del valor guardado falla, cae al código INE crudo (I1)", () => {
    useSearchPlacesMock.mockReturnValue({ data: [], isError: false, error: null });
    usePlacesByIneMock.mockReturnValue({ data: undefined, isPending: false, isError: true });

    render(<SedeSelector id="sede" value="20069" onChange={vi.fn()} />);

    expect(screen.getByText("Municipio actual (INE 20069)")).toBeInTheDocument();
  });

  it("si la búsqueda falla lo dice, en vez de dejar el selector vacío en silencio", () => {
    useSearchPlacesMock.mockReturnValue({ data: undefined, isError: true, error: { kind: "desconocido" } });
    mockEmptyCurrentPlace();

    render(<SedeSelector id="sede" value={null} onChange={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo buscar el municipio.");
  });
});
