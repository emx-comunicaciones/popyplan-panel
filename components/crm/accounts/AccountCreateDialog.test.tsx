/**
 * «Nueva entidad» del CRM ante un 409. Con duplicados que quien crea puede
 * ver, la lista y «Crear igualmente» (`force`). Si la cuenta ya la lleva
 * otro comercial (decisión del propietario, 2026-10-01), el backend solo
 * manda `detail`, sin lista y sin `force` posible: no se ofrece el botón.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";

const useCreateAccountMock = vi.hoisted(() => vi.fn());
const useDuplicatesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useCrm", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCrm")>("@/hooks/useCrm");
  return {
    ...actual,
    useCreateAccount: useCreateAccountMock,
    useCrmAccountDuplicates: useDuplicatesMock,
  };
});

import { CrmError } from "@/hooks/useCrm";

import { AccountCreateDialog } from "./AccountCreateDialog";

afterEach(() => {
  useCreateAccountMock.mockReset();
  useDuplicatesMock.mockReset();
});

function conError(error: CrmError | null) {
  useDuplicatesMock.mockReturnValue({ data: [] });
  useCreateAccountMock.mockReturnValue({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: error !== null,
    error,
  });
}

describe("AccountCreateDialog", () => {
  it("con duplicados visibles, los lista y ofrece «Crear igualmente»", () => {
    conError(
      new CrmError("duplicado", "Ya existe una entidad parecida.", {
        detail: "Ya existe una cuenta parecida.",
        duplicates: [{ id: 4, name: "Ayuntamiento de Irun", municipality: "Irun", owner_name: "Mikel Test" }],
      }),
    );
    render(<AccountCreateDialog isManager={false} onClose={vi.fn()} />);
    expect(screen.getByText("Ayuntamiento de Irun")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear igualmente" })).toBeInTheDocument();
  });

  it("si la lleva otro comercial, dice el motivo y no ofrece «Crear igualmente»", () => {
    conError(
      new CrmError("duplicado", "Ya existe una entidad parecida.", {
        detail: "Esta cuenta ya la lleva otra persona del equipo comercial.",
      }),
    );
    render(<AccountCreateDialog isManager={false} onClose={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta cuenta ya la lleva otra persona del equipo comercial.",
    );
    expect(screen.queryByRole("button", { name: "Crear igualmente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });
});
