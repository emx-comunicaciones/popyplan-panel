import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@/test-utils/render";
import { buildProgram } from "@/test-utils/fixtures/program";

const useCreateProgramMock = vi.hoisted(() => vi.fn());
const useUpdateProgramMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useProgramMutations", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProgramMutations")>(
    "@/hooks/useProgramMutations",
  );
  return {
    ...actual,
    useCreateProgram: useCreateProgramMock,
    useUpdateProgram: useUpdateProgramMock,
  };
});

import { ProgramaForm } from "./ProgramaForm";

function mutationDefaults(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null, ...overrides };
}

afterEach(() => {
  useCreateProgramMock.mockReset();
  useUpdateProgramMock.mockReset();
});

describe("ProgramaForm", () => {
  it("crear: envía los campos convertidos, budget_cents incluido", async () => {
    const mutate = vi.fn();
    useCreateProgramMock.mockReturnValue(mutationDefaults({ mutate }));
    useUpdateProgramMock.mockReturnValue(mutationDefaults());

    const user = userEvent.setup();
    render(<ProgramaForm orgId={7} editing="new" onDone={vi.fn()} />);

    await user.type(screen.getByLabelText("Nombre"), "Refuerzo escolar");
    await user.type(screen.getByLabelText("Financiador"), "Diputación");
    await user.type(screen.getByLabelText("Inicio"), "2026-01-01");
    await user.type(screen.getByLabelText("Fin"), "2026-06-30");
    await user.type(screen.getByLabelText("Presupuesto (€)"), "1200.50");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith(
      {
        name: "Refuerzo escolar",
        funder: "Diputación",
        description: "",
        starts_on: "2026-01-01",
        ends_on: "2026-06-30",
        budget_cents: 120050,
      },
      expect.anything(),
    );
  });

  it("editar: precarga los campos desde el programa, incluido el presupuesto en euros", () => {
    useCreateProgramMock.mockReturnValue(mutationDefaults());
    useUpdateProgramMock.mockReturnValue(mutationDefaults());
    const program = buildProgram({ name: "Programa existente", budget_cents: 250000 });

    render(<ProgramaForm orgId={7} editing={program} onDone={vi.fn()} />);

    expect(screen.getByLabelText("Nombre")).toHaveValue("Programa existente");
    expect(screen.getByLabelText("Presupuesto (€)")).toHaveValue(2500);
  });

  it("editar: manda PATCH solo con programId y los campos del formulario", async () => {
    const mutate = vi.fn();
    useCreateProgramMock.mockReturnValue(mutationDefaults());
    useUpdateProgramMock.mockReturnValue(mutationDefaults({ mutate }));
    const program = buildProgram({ id: 9 });

    const user = userEvent.setup();
    render(<ProgramaForm orgId={7} editing={program} onDone={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ programId: 9, name: program.name }),
      expect.anything(),
    );
  });

  it("fin anterior a inicio: pinta el mensaje literal del backend y desactiva Guardar", async () => {
    useCreateProgramMock.mockReturnValue(mutationDefaults());
    useUpdateProgramMock.mockReturnValue(mutationDefaults());

    const user = userEvent.setup();
    render(<ProgramaForm orgId={7} editing="new" onDone={vi.fn()} />);

    await user.type(screen.getByLabelText("Nombre"), "X");
    await user.type(screen.getByLabelText("Inicio"), "2026-06-30");
    await user.type(screen.getByLabelText("Fin"), "2026-01-01");
    await user.type(screen.getByLabelText("Presupuesto (€)"), "100");

    expect(
      screen.getByText("La fecha de fin no puede ser anterior a la de inicio."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("presupuesto negativo desactiva Guardar", async () => {
    useCreateProgramMock.mockReturnValue(mutationDefaults());
    useUpdateProgramMock.mockReturnValue(mutationDefaults());

    const user = userEvent.setup();
    render(<ProgramaForm orgId={7} editing="new" onDone={vi.fn()} />);

    await user.type(screen.getByLabelText("Nombre"), "Refuerzo escolar");
    await user.type(screen.getByLabelText("Inicio"), "2026-01-01");
    await user.type(screen.getByLabelText("Fin"), "2026-06-30");
    // fireEvent en vez de user.type: jsdom sanea el valor intermedio «-»
    // de un input type=number a cadena vacía y el «-5» nunca llegaría.
    fireEvent.change(screen.getByLabelText("Presupuesto (€)"), { target: { value: "-5" } });

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("cancelar llama a onDone sin mutar", async () => {
    useCreateProgramMock.mockReturnValue(mutationDefaults());
    useUpdateProgramMock.mockReturnValue(mutationDefaults());
    const onDone = vi.fn();

    const user = userEvent.setup();
    render(<ProgramaForm orgId={7} editing="new" onDone={onDone} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onDone).toHaveBeenCalled();
  });

  it("con el guardado en vuelo, «Cancelar» está deshabilitado", () => {
    useCreateProgramMock.mockReturnValue(mutationDefaults({ isPending: true }));
    useUpdateProgramMock.mockReturnValue(mutationDefaults());

    render(<ProgramaForm orgId={7} editing="new" onDone={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("avisa a quien lo monta de si el guardado está en vuelo", () => {
    const onPendingChange = vi.fn();
    useCreateProgramMock.mockReturnValue(mutationDefaults({ isPending: true }));
    useUpdateProgramMock.mockReturnValue(mutationDefaults());

    render(<ProgramaForm orgId={7} editing="new" onDone={vi.fn()} onPendingChange={onPendingChange} />);

    expect(onPendingChange).toHaveBeenCalledWith(true);
  });

  it("al desmontarse avisa de que ya no hay nada en vuelo", () => {
    const onPendingChange = vi.fn();
    useCreateProgramMock.mockReturnValue(mutationDefaults({ isPending: true }));
    useUpdateProgramMock.mockReturnValue(mutationDefaults());

    const { unmount } = render(
      <ProgramaForm orgId={7} editing="new" onDone={vi.fn()} onPendingChange={onPendingChange} />,
    );
    onPendingChange.mockClear();
    unmount();

    expect(onPendingChange).toHaveBeenCalledWith(false);
  });

  it("muestra el error de la mutación", () => {
    useCreateProgramMock.mockReturnValue(
      mutationDefaults({ isError: true, error: new Error("No se pudo crear el programa.") }),
    );
    useUpdateProgramMock.mockReturnValue(mutationDefaults());

    render(<ProgramaForm orgId={7} editing="new" onDone={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo crear el programa.");
  });
});
