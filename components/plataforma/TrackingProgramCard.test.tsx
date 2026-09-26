import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";

const mutate = vi.hoisted(() => vi.fn());
const reset = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ isError: false, isPending: false, error: null as unknown }));
vi.mock("@/hooks/useSetTrackingProgram", () => ({
  useSetTrackingProgram: () => ({ mutate, reset, ...state }),
}));

import { TrackingProgramCard } from "./TrackingProgramCard";

afterEach(() => {
  mutate.mockReset();
  reset.mockReset();
  state.isError = false;
  state.error = null;
});

describe("TrackingProgramCard", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<TrackingProgramCard orgId={96} enabled={false} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("es un interruptor con su estado; encender pide confirmación que explica los datos de salud", async () => {
    render(<TrackingProgramCard orgId={96} enabled={false} />);
    const toggle = screen.getByRole("switch", { name: "Programa de seguimiento activado" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await userEvent.click(toggle);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Activar el programa de seguimiento?");
    expect(dialog).toHaveTextContent(/datos de salud/);
    expect(mutate).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Activar" }));
    expect(mutate).toHaveBeenCalledWith(true, expect.objectContaining({ onSuccess: expect.any(Function) }));
  });

  it("apagar explica que las inscripciones quedan en suspenso; cancelar no manda nada", async () => {
    render(<TrackingProgramCard orgId={96} enabled />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");

    await userEvent.click(screen.getByRole("switch"));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent(/quedan en suspenso/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("el error del backend (entidad no verificada) se pinta literal dentro del diálogo", async () => {
    state.isError = true;
    state.error = { kind: "invalido", message: "x", detail: "Solo asociaciones u ONG verificadas." };
    render(<TrackingProgramCard orgId={96} enabled={false} />);

    await userEvent.click(screen.getByRole("switch"));
    expect(within(screen.getByRole("alertdialog")).getByRole("alert")).toHaveTextContent(
      "Solo asociaciones u ONG verificadas.",
    );
  });
});
