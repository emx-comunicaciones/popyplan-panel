import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";

const useAllOrganizationsMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useOrganizations", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useOrganizations")>("@/hooks/useOrganizations");
  return { ...actual, useAllOrganizations: useAllOrganizationsMock };
});

const useContractsMock = vi.hoisted(() => vi.fn());
const useMutationStub = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useBilling", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useBilling")>("@/hooks/useBilling");
  return {
    ...actual,
    useContracts: useContractsMock,
    useActivateContract: useMutationStub,
    useEndContract: useMutationStub,
  };
});

import { OrganizationsError } from "@/hooks/useOrganizations";

import { ContratosPanel } from "./ContratosPanel";

afterEach(() => {
  useAllOrganizationsMock.mockReset();
  useContractsMock.mockReset();
  useMutationStub.mockReset();
});

function mockBilling() {
  useContractsMock.mockReturnValue({ data: [], isError: false, isPending: false });
  useMutationStub.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });
}

describe("ContratosPanel", () => {
  it("si el listado de entidades falla, el filtro avisa con role=alert en vez de quedarse vacío", () => {
    mockBilling();
    useAllOrganizationsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new OrganizationsError("Hay demasiadas entidades para cargarlas todas; contacta con Popyplan."),
    });

    // `role` es el rol de plataforma, no un rol ARIA.
    const props = { role: "superadmin" };
    render(<ContratosPanel {...props} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las entidades");
  });
});
