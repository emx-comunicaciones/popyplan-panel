import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";
import { render, screen } from "@/test-utils/render";

import { PeriodSelector, type PeriodSelectorProps } from "./PeriodSelector";

/**
 * El `rerender` de Testing Library con el `render` propio del repo
 * desmonta el componente (el envoltorio del proveedor deja de estar en la
 * raíz), y un remontaje reinicia el estado, que es justo lo que estos
 * tests no deben ejercitar. Este arnés mantiene el selector montado y
 * cambia el periodo desde el padre, como hace un dashboard.
 */
function Harness({ onChange = () => {} }: { onChange?: PeriodSelectorProps["onChange"] }) {
  const [period, setPeriod] = useState<Period>({ since: "2026-01-01", until: "2026-01-31" });
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [, forceRender] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPeriod({ since: "2023-01-01", until: "2026-09-18" });
          setPreset("plurianual");
        }}
      >
        Periodo de fuera
      </button>
      <button type="button" onClick={() => forceRender((n) => n + 1)}>
        Repintar sin cambiar el periodo
      </button>
      <PeriodSelector value={period} preset={preset} onChange={onChange} />
    </>
  );
}

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

  it("si el periodo cambia desde fuera, los campos de fecha se ponen al día", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByLabelText("Desde")).toHaveValue("2026-01-01");

    await user.click(screen.getByRole("button", { name: "Periodo de fuera" }));

    expect(screen.getByLabelText("Desde")).toHaveValue("2023-01-01");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-09-18");
  });

  it("«Personalizado» manda el rango puesto al día, no el que había al montarse", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Periodo de fuera" }));
    await user.click(screen.getByRole("button", { name: "Personalizado" }));

    expect(onChange).toHaveBeenCalledWith({ since: "2023-01-01", until: "2026-09-18" }, "personalizado");
  });

  it("no pisa lo que se está tecleando cuando el periodo de fuera no ha cambiado", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.clear(screen.getByLabelText("Desde"));
    await user.type(screen.getByLabelText("Desde"), "2026-03-15");

    // Un re-render del padre con las mismas fechas (otro objeto) no puede
    // borrar lo tecleado.
    await user.click(screen.getByRole("button", { name: "Repintar sin cambiar el periodo" }));

    expect(screen.getByLabelText("Desde")).toHaveValue("2026-03-15");
  });

  it("un rango demasiado ancho avisa con la regla de la diferencia entre fechas", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PeriodSelector
        value={{ since: "2026-01-01", until: "2026-01-31" }}
        preset="mes"
        onChange={onChange}
      />,
    );

    // 1462 días de diferencia: uno más de los que acepta el backend.
    await user.clear(screen.getByLabelText("Desde"));
    await user.type(screen.getByLabelText("Desde"), "2021-01-01");
    await user.clear(screen.getByLabelText("Hasta"));
    await user.type(screen.getByLabelText("Hasta"), "2025-01-02");
    await user.click(screen.getByRole("button", { name: "Personalizado" }));

    expect(
      screen.getByText(
        "El periodo no puede abarcar más de 1461 días entre las dos fechas (unos 4 años).",
      ),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("un rango de 1461 días de diferencia se acepta, como en el backend", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PeriodSelector
        value={{ since: "2026-01-01", until: "2026-01-31" }}
        preset="mes"
        onChange={onChange}
      />,
    );

    await user.clear(screen.getByLabelText("Desde"));
    await user.type(screen.getByLabelText("Desde"), "2021-01-01");
    await user.clear(screen.getByLabelText("Hasta"));
    await user.type(screen.getByLabelText("Hasta"), "2025-01-01");
    await user.click(screen.getByRole("button", { name: "Personalizado" }));

    expect(onChange).toHaveBeenCalledWith({ since: "2021-01-01", until: "2025-01-01" }, "personalizado");
  });

  it("al pulsar un preset avisa con el periodo y el preset elegidos", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PeriodSelector value={presetPeriod("mes")} preset="mes" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Año" }));

    expect(onChange).toHaveBeenCalledWith(presetPeriod("anio"), "anio");
  });
});
