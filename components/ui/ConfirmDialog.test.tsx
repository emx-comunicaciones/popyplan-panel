import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";

import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("Escape llama a onCancel cuando no hay una acción pendiente", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="¿Borrar el recurso?" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });

  it("Escape NO llama a onCancel mientras la acción está pendiente (los botones ya están deshabilitados)", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="¿Borrar el recurso?"
        pending
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("dos diálogos abiertos a la vez tienen cada uno su propio nombre accesible", () => {
    // Con un `id` fijo, `aria-labelledby` de los dos apuntaba al primer
    // `<h2>` del documento y ambos se anunciaban con el mismo título.
    render(
      <>
        <ConfirmDialog open title="Quitar del equipo" onConfirm={vi.fn()} onCancel={vi.fn()} />
        <ConfirmDialog open title="Quitar referencia" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </>,
    );

    expect(screen.getByRole("alertdialog", { name: "Quitar del equipo" })).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Quitar referencia" })).toBeInTheDocument();
  });
});
