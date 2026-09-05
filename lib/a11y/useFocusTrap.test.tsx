import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useFocusTrap } from "./useFocusTrap";

function TestDialog({ active, onEscape }: { active: boolean; onEscape?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active, onEscape);

  return (
    <div>
      <button type="button">Fuera</button>
      {active ? (
        <div ref={ref} tabIndex={-1} data-testid="dialog">
          <button type="button">Primero</button>
          <button type="button">Último</button>
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
});
