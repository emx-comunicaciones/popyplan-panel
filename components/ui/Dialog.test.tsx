import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { cleanup, render, screen } from "@/test-utils/render";

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

  // Dos `render()` en vez del `rerender` del brief: `test-utils/render`
  // envuelve el árbol a mano en `NextIntlClientProvider`, así que el
  // `rerender` de Testing Library (que solo reusa `options.wrapper`)
  // volvería a montar el diálogo sin ese contexto.
  it("por defecto se centra; con placement='side' se ancla al lado", () => {
    const centered = render(
      <Dialog open titleId="t" title="Ficha" onClose={vi.fn()}>
        <p>contenido</p>
      </Dialog>,
    );
    expect(centered.container.firstChild).toHaveClass("justify-center");
    expect(centered.container.firstChild).toHaveClass("items-center");

    cleanup();

    const side = render(
      <Dialog open titleId="t" title="Ficha" onClose={vi.fn()} placement="side">
        <p>contenido</p>
      </Dialog>,
    );
    expect(side.container.firstChild).toHaveClass("justify-end");
    expect(side.container.firstChild).not.toHaveClass("justify-center");
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
