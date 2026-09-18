import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";

import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("Escape y el botón × cierran cuando no hay nada en vuelo", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open titleId="t" title="Añadir persona" onClose={onClose}>
        <p>Contenido</p>
      </Dialog>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("con `pending`, ni Escape ni el botón × cierran, y el diálogo se marca aria-busy", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open titleId="t" title="Añadir persona" pending onClose={onClose}>
        <p>Contenido</p>
      </Dialog>,
    );

    await user.keyboard("{Escape}");

    const closeButton = screen.getByRole("button", { name: "Cerrar" });
    expect(closeButton).toBeDisabled();
    // El guard del `onClick` no depende de `disabled`: un click programático
    // sobre el botón tampoco cierra.
    closeButton.click();

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
  });

  it("cerrado, no pinta nada", () => {
    render(
      <Dialog open={false} titleId="t" title="Añadir persona" onClose={vi.fn()}>
        <p>Contenido</p>
      </Dialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
