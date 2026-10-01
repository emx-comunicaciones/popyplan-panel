import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";

const useAllOrganizationsMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useOrganizations", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useOrganizations")>("@/hooks/useOrganizations");
  return { ...actual, useAllOrganizations: useAllOrganizationsMock };
});

const useTiersMock = vi.hoisted(() => vi.fn());
const useCreateContractMock = vi.hoisted(() => vi.fn());
const useUpdateContractMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useBilling", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useBilling")>("@/hooks/useBilling");
  return {
    ...actual,
    useTiers: useTiersMock,
    useCreateContract: useCreateContractMock,
    useUpdateContract: useUpdateContractMock,
  };
});

import { OrganizationsError } from "@/hooks/useOrganizations";

import { ContratoForm } from "./ContratoForm";

afterEach(() => {
  useAllOrganizationsMock.mockReset();
  useTiersMock.mockReset();
  useCreateContractMock.mockReset();
  useUpdateContractMock.mockReset();
});

function mockBilling() {
  useTiersMock.mockReturnValue({ data: [], isError: false });
  const mutation = { mutate: vi.fn(), isPending: false, isError: false, error: null };
  useCreateContractMock.mockReturnValue(mutation);
  useUpdateContractMock.mockReturnValue(mutation);
}

describe("ContratoForm", () => {
  it("si el listado de entidades falla, avisa con role=alert en vez de dejar el selector vacío", () => {
    mockBilling();
    useAllOrganizationsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new OrganizationsError("Hay demasiadas entidades para cargarlas todas; contacta con Popyplan."),
    });

    render(<ContratoForm editing="new" onDone={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las entidades");
  });

  it("con las entidades cargadas no pinta ningún aviso", () => {
    mockBilling();
    useAllOrganizationsMock.mockReturnValue({
      data: { count: 0, next: null, previous: null, results: [] },
      isError: false,
      error: null,
    });

    render(<ContratoForm editing="new" onDone={vi.fn()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
