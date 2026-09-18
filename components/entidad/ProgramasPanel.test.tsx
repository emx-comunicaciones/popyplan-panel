import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { buildProgram } from "@/test-utils/fixtures/program";

const useProgramsMock = vi.hoisted(() => vi.fn());
const useCreateProgramMock = vi.hoisted(() => vi.fn());
const useUpdateProgramMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/usePrograms", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePrograms")>("@/hooks/usePrograms");
  return { ...actual, usePrograms: useProgramsMock };
});
vi.mock("@/hooks/useProgramMutations", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProgramMutations")>(
    "@/hooks/useProgramMutations",
  );
  return { ...actual, useCreateProgram: useCreateProgramMock, useUpdateProgram: useUpdateProgramMock };
});

import { ProgramasPanel } from "./ProgramasPanel";

afterEach(() => {
  useProgramsMock.mockReset();
  useCreateProgramMock.mockReset();
  useUpdateProgramMock.mockReset();
});

function mutationDefaults(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null, ...overrides };
}

describe("ProgramasPanel", () => {
  it("cargando: muestra el mensaje de carga", () => {
    useProgramsMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(<ProgramasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getByText("Cargando programas…")).toBeInTheDocument();
  });

  it("error: muestra ErrorState con el mensaje del hook", () => {
    useProgramsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar los programas."),
    });

    render(<ProgramasPanel orgId={7} slug="alfaville" canManage />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar los programas");
  });

  it("sin programas: estado vacío", () => {
    useProgramsMock.mockReturnValue({ data: [], isError: false, error: null });

    render(<ProgramasPanel orgId={7} slug="alfaville" canManage={false} />);

    expect(screen.getByText("Sin programas todavía")).toBeInTheDocument();
  });

  it("lista programas con estado, presupuesto y enlace a su ficha", () => {
    useProgramsMock.mockReturnValue({
      data: [
        buildProgram({ id: 5, name: "Refuerzo escolar", status: "active", budget_cents: 500000 }),
      ],
      isError: false,
      error: null,
    });

    render(<ProgramasPanel orgId={7} slug="alfaville" canManage={false} />);

    expect(screen.getByText("Refuerzo escolar")).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Refuerzo escolar" })).toHaveAttribute(
      "href",
      "/entidad/alfaville/programas/5",
    );
  });

  it("canManage=false: no ve «Nuevo programa»", () => {
    useProgramsMock.mockReturnValue({ data: [], isError: false, error: null });

    render(<ProgramasPanel orgId={7} slug="alfaville" canManage={false} />);

    expect(screen.queryByRole("button", { name: "Nuevo programa" })).not.toBeInTheDocument();
  });

  it("canManage=true: «Nuevo programa» abre el diálogo con el formulario", async () => {
    useProgramsMock.mockReturnValue({ data: [], isError: false, error: null });
    useCreateProgramMock.mockReturnValue(mutationDefaults());
    useUpdateProgramMock.mockReturnValue(mutationDefaults());

    const user = userEvent.setup();
    render(<ProgramasPanel orgId={7} slug="alfaville" canManage />);

    await user.click(screen.getByRole("button", { name: "Nuevo programa" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Nombre")).toBeInTheDocument();
  });

  it("con el alta en vuelo, ni Escape ni el botón × cierran el diálogo", async () => {
    useProgramsMock.mockReturnValue({ data: [], isError: false, error: null });
    useCreateProgramMock.mockReturnValue(mutationDefaults({ isPending: true }));
    useUpdateProgramMock.mockReturnValue(mutationDefaults());

    const user = userEvent.setup();
    render(<ProgramasPanel orgId={7} slug="alfaville" canManage />);

    await user.click(screen.getByRole("button", { name: "Nuevo programa" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
  });
});
