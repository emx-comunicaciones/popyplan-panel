import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useFocusTrap } from "./useFocusTrap";

function TestDialog({
  active,
  onEscape,
  empty = false,
}: {
  active: boolean;
  onEscape?: () => void;
  /** Diálogo sin nada enfocable dentro (un aviso de solo lectura). */
  empty?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active, onEscape);

  return (
    <div>
      <button type="button">Fuera</button>
      {active ? (
        <div ref={ref} tabIndex={-1} data-testid="dialog">
          {empty ? (
            <>
              <p>Sin controles</p>
              {/* Ninguno de los dos cuenta como enfocable: un campo oculto
                  no recibe el foco, y `tabindex="-1"` está fuera del orden
                  de tabulación. */}
              <input type="hidden" name="token" defaultValue="x" />
              <button type="button" tabIndex={-1}>
                Fuera del orden de tabulación
              </button>
            </>
          ) : (
            <>
              <button type="button">Primero</button>
              <button type="button">Último</button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

describe("useFocusTrap", () => {
  it("mueve el foco al primer elemento enfocable del contenedor al activarse", () => {
    render(<TestDialog active />);

    expect(screen.getByRole("button", { name: "Primero" })).toHaveFocus();
  });

  it("Tab desde el último elemento vuelve al primero (atrapa el foco)", async () => {
    const user = userEvent.setup();
    render(<TestDialog active />);

    screen.getByRole("button", { name: "Último" }).focus();
    await user.tab();

    expect(screen.getByRole("button", { name: "Primero" })).toHaveFocus();
  });

  it("Shift+Tab desde el primer elemento va al último (atrapa el foco al revés)", async () => {
    const user = userEvent.setup();
    render(<TestDialog active />);

    await user.tab({ shift: true });

    expect(screen.getByRole("button", { name: "Último" })).toHaveFocus();
  });

  it("Escape llama a onEscape", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<TestDialog active onEscape={onEscape} />);

    await user.keyboard("{Escape}");

    expect(onEscape).toHaveBeenCalled();
  });

  it("si el foco está fuera del diálogo, Tab lo devuelve al primer elemento (no escapa)", async () => {
    const user = userEvent.setup();
    render(<TestDialog active />);

    // Un clic en el fondo, o un foco perdido tras desmontarse el control
    // que lo tenía, deja `document.activeElement` en el `<body>`: sin
    // guardia, el siguiente Tab salta al primer enfocable de la página
    // de detrás («Fuera»).
    (document.activeElement as HTMLElement | null)?.blur();
    await user.tab();

    expect(screen.getByRole("button", { name: "Primero" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Fuera" })).not.toHaveFocus();
  });

  it("un diálogo sin nada enfocable recibe el foco en el propio contenedor", () => {
    render(<TestDialog active empty />);

    // Ni el `input[type="hidden"]` ni el botón con `tabindex="-1"`
    // cuentan como enfocables.
    expect(screen.getByTestId("dialog")).toHaveFocus();
  });

  it("un diálogo sin nada enfocable atrapa Tab en el contenedor", async () => {
    const user = userEvent.setup();
    render(<TestDialog active empty />);

    await user.tab();

    expect(screen.getByTestId("dialog")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Fuera" })).not.toHaveFocus();
  });

  it("al desactivarse devuelve el foco a donde estaba antes", async () => {
    const outer = document.createElement("button");
    document.body.appendChild(outer);
    outer.focus();

    const { rerender } = render(<TestDialog active={false} />);
    rerender(<TestDialog active />);
    rerender(<TestDialog active={false} />);

    expect(outer).toHaveFocus();
    outer.remove();
  });

  it("si quien abrió el diálogo ya no está en el documento, el foco va al contenido principal", () => {
    // Caso real: una fila de tabla que desaparece de la lista al
    // confirmar la acción del diálogo. Devolver el foco a un nodo
    // desmontado lo deja en el `<body>` y quien navega con teclado
    // vuelve al principio de la página.
    const main = document.createElement("main");
    main.id = "main-content";
    main.tabIndex = -1;
    document.body.appendChild(main);
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(<TestDialog active={false} />);
    rerender(<TestDialog active />);
    opener.remove();
    rerender(<TestDialog active={false} />);

    expect(main).toHaveFocus();
    main.remove();
  });

  it("sin contenido principal al que volver, el foco cae al body", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(<TestDialog active={false} />);
    rerender(<TestDialog active />);
    opener.remove();
    rerender(<TestDialog active={false} />);

    expect(document.body).toHaveFocus();
  });
});
