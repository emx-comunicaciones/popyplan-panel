import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { presetPeriod } from "@/lib/metrics/period";
import { render, screen } from "@/test-utils/render";

import { PeriodSelector } from "./PeriodSelector";

describe("PeriodSelector", () => {
  it("el preset activo se anuncia con aria-pressed, el resto no", () => {
    render(
      <PeriodSelector value={presetPeriod("trimestre")} preset="trimestre" onChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Trimestre" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Este mes" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Año" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Plurianual" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Personalizado" })).toHaveAttribute("aria-pressed", "false");
  });

  it("«Personalizado» queda pulsado cuando el periodo es un rango a mano", () => {
    render(
      <PeriodSelector
        value={{ since: "2026-01-01", until: "2026-02-01" }}
        preset="personalizado"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Personalizado" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Este mes" })).toHaveAttribute("aria-pressed", "false");
  });

  it("al pulsar un preset avisa con el periodo y el preset elegidos", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PeriodSelector value={presetPeriod("mes")} preset="mes" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Año" }));

    expect(onChange).toHaveBeenCalledWith(presetPeriod("anio"), "anio");
  });
});
