import userEvent from "@testing-library/user-event";
import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { buildOrganization } from "@/test-utils/fixtures/organization";

const usePlacesCountMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/usePlaces", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePlaces")>("@/hooks/usePlaces");
  return { ...actual, usePlacesCount: usePlacesCountMock };
});

const useSetOrganizationTerritoryMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useSetOrganizationTerritory", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useSetOrganizationTerritory")>(
    "@/hooks/useSetOrganizationTerritory",
  );
  return { ...actual, useSetOrganizationTerritory: useSetOrganizationTerritoryMock };
});

import { countMunicipios, TerritorioForm } from "./TerritorioForm";

const mutateMock = vi.fn();

function mockSave(overrides: Partial<ReturnType<typeof useSetOrganizationTerritoryMock>> = {}) {
  useSetOrganizationTerritoryMock.mockReturnValue({
    mutate: mutateMock,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    ...overrides,
  });
}

afterEach(() => {
  vi.useRealTimers();
  usePlacesCountMock.mockReset();
  useSetOrganizationTerritoryMock.mockReset();
  mutateMock.mockReset();
});

describe("TerritorioForm", () => {
  it("la vista previa cuenta los códigos escritos con «municipios», sin pedir nada", async () => {
    mockSave();
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(<TerritorioForm organization={buildOrganization({ territory_kind: "municipios" })} orgId="7" />);
    await userEvent.type(screen.getByLabelText("Códigos INE separados por comas"), "20069, 20045");

    expect(screen.getByText("2 municipios en la lista escrita")).toBeInTheDocument();
  });

  it("con un atajo y un código escrito enseña el total que devuelve el backend", () => {
    mockSave();
    vi.useFakeTimers();
    usePlacesCountMock.mockReturnValue({ data: 88, isError: false, error: null });

    render(
      <TerritorioForm
        organization={buildOrganization({ territory_kind: "provincia", territory_places_count: 0 })}
        orgId="7"
      />,
    );
    fireEvent.change(screen.getByLabelText("Código del territorio"), { target: { value: "20" } });
    act(() => vi.advanceTimersByTime(300));

    expect(usePlacesCountMock).toHaveBeenLastCalledWith("provincia", "20");
    expect(screen.getByText("88 municipios en el código escrito")).toBeInTheDocument();
  });

  it("sin código escrito todavía, enseña el recuento ya guardado", () => {
    mockSave();
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(
      <TerritorioForm
        organization={buildOrganization({
          territory_kind: "provincia",
          territory_code: "",
          territory_places_count: 88,
        })}
        orgId="7"
      />,
    );

    expect(screen.getByText("88 municipios en el territorio guardado")).toBeInTheDocument();
  });

  it("si la cuenta falla lo dice, en vez de enseñar un cero que se leería como «ese código no tiene municipios»", () => {
    mockSave();
    vi.useFakeTimers();
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: true, error: { kind: "desconocido" } });

    render(<TerritorioForm organization={buildOrganization({ territory_kind: "provincia" })} orgId="7" />);
    fireEvent.change(screen.getByLabelText("Código del territorio"), { target: { value: "20" } });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("No se pudo contar los municipios de ese código.")).toBeInTheDocument();
  });

  it("mientras se cuenta con retardo, dice que está contando", () => {
    mockSave();
    vi.useFakeTimers();
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(<TerritorioForm organization={buildOrganization({ territory_kind: "provincia" })} orgId="7" />);
    fireEvent.change(screen.getByLabelText("Código del territorio"), { target: { value: "20" } });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("Contando municipios…")).toBeInTheDocument();
  });

  it("envía el nivel, el tipo de territorio y el código al guardar", async () => {
    mockSave();
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(
      <TerritorioForm
        organization={buildOrganization({ admin_level: "diputacion", territory_kind: "provincia", territory_code: "20" })}
        orgId="7"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutateMock).toHaveBeenCalledWith({
      admin_level: "diputacion",
      territory_kind: "provincia",
      territory_code: "20",
    });
  });

  it("usa el `orgId` de la prop para el hook, nunca `organization.id` (fix round 1)", () => {
    mockSave();
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: false, error: null });

    // `organization.id` (number, 999) y `orgId` (el parámetro de ruta,
    // string) difieren a propósito: si el componente volviera a leer
    // `organization.id` esta aserción lo delataría.
    render(<TerritorioForm organization={buildOrganization({ id: 999 })} orgId="7" />);

    expect(useSetOrganizationTerritoryMock).toHaveBeenCalledWith("7");
  });

  it("un error de guardado se pinta como alerta con el texto del kind", () => {
    mockSave({
      isError: true,
      error: { kind: "sin_permiso", message: "Solo superadmin declara el territorio." },
    });
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(<TerritorioForm organization={buildOrganization()} orgId="7" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Solo superadmin declara el territorio.");
  });

  it("el detalle literal del backend, cuando lo hay, tiene prioridad sobre el texto por kind", () => {
    mockSave({
      isError: true,
      error: { kind: "invalido", detail: "Ese código no tiene municipios activos." },
    });
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(<TerritorioForm organization={buildOrganization()} orgId="7" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Ese código no tiene municipios activos.");
  });

  it("un guardado correcto pinta el aviso de éxito", () => {
    mockSave({ isSuccess: true });
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(<TerritorioForm organization={buildOrganization()} orgId="7" />);

    expect(screen.getByText("Guardado.")).toBeInTheDocument();
  });
});

describe("countMunicipios", () => {
  it("cadena vacía cuenta 0", () => {
    expect(countMunicipios("")).toBe(0);
  });

  it("comas de más no cuentan como código", () => {
    expect(countMunicipios("20069,,20045,")).toBe(2);
  });

  it("espacios alrededor sí cuentan", () => {
    expect(countMunicipios(" 20069 ,  20045 ")).toBe(2);
  });
});
