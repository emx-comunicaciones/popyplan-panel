import userEvent from "@testing-library/user-event";
import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { buildPlaceRow } from "@/test-utils/fixtures/places";

const useSearchPlacesMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/usePlaces", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePlaces")>("@/hooks/usePlaces");
  return { ...actual, useSearchPlaces: useSearchPlacesMock };
});

import { SedeSelector } from "./SedeSelector";

// Los campos con retardo se prueban con `fireEvent.change` +
// `vi.advanceTimersByTime`, nunca con `userEvent` y temporizadores
// falsos: `userEvent` se cuelga en esta suite (ver CLAUDE.md,
// «Buscadores con retardo»).
afterEach(() => {
  vi.useRealTimers();
  useSearchPlacesMock.mockReset();
});

describe("SedeSelector", () => {
  it("busca municipios con retardo y ofrece los resultados", () => {
    vi.useFakeTimers();
    useSearchPlacesMock.mockReturnValue({ data: [buildPlaceRow()], isError: false, error: null });

    render(<SedeSelector id="sede" value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Buscar un municipio"), { target: { value: "irun" } });
    act(() => vi.advanceTimersByTime(300));

    expect(useSearchPlacesMock).toHaveBeenLastCalledWith("irun");
    expect(screen.getByRole("option", { name: "Irun (Gipuzkoa) · 20069" })).toBeInTheDocument();
  });

  it("elegir un municipio devuelve su código INE", async () => {
    const onChange = vi.fn();
    useSearchPlacesMock.mockReturnValue({ data: [buildPlaceRow()], isError: false, error: null });

    render(<SedeSelector id="sede" value={null} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Municipio de la sede"), "20069");

    expect(onChange).toHaveBeenCalledWith("20069");
  });

  it("elegir «Sin municipio» devuelve null", async () => {
    const onChange = vi.fn();
    useSearchPlacesMock.mockReturnValue({ data: [buildPlaceRow()], isError: false, error: null });

    render(<SedeSelector id="sede" value="20069" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Municipio de la sede"), "Sin municipio");

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("el valor ya guardado sigue seleccionable aunque la búsqueda no lo devuelva", () => {
    useSearchPlacesMock.mockReturnValue({ data: [], isError: false, error: null });

    render(<SedeSelector id="sede" value="20069" onChange={vi.fn()} />);

    expect(screen.getByLabelText("Municipio de la sede")).toHaveValue("20069");
    expect(screen.getByText("Municipio actual (INE 20069)")).toBeInTheDocument();
  });

  it("si la búsqueda falla lo dice, en vez de dejar el selector vacío en silencio", () => {
    useSearchPlacesMock.mockReturnValue({ data: undefined, isError: true, error: { kind: "desconocido" } });

    render(<SedeSelector id="sede" value={null} onChange={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo buscar el municipio.");
  });
});
