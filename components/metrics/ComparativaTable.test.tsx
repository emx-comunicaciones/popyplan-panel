import { describe, expect, it } from "vitest";

import { axe } from "@/test-utils/axe";
import { buildCompareResponse } from "@/test-utils/fixtures/metrics";
import { render, screen } from "@/test-utils/render";

import { ComparativaTable } from "./ComparativaTable";

describe("ComparativaTable", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<ComparativaTable data={buildCompareResponse()} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("pinta la leyenda del periodo anterior", () => {
    render(<ComparativaTable data={buildCompareResponse()} />);

    expect(screen.getByText("frente a 31 dic – 31 mar 2026")).toBeInTheDocument();
  });

  it("caption con el desglose de la respuesta", () => {
    render(<ComparativaTable data={buildCompareResponse({ group_by: "organization" })} />);

    expect(screen.getByText("Comparativa por entidad")).toBeInTheDocument();
  });

  it("fila sin suprimir: actual/anterior/Δ de las tres métricas", () => {
    render(<ComparativaTable data={buildCompareResponse()} />);

    expect(screen.getByText("Bidasoa")).toBeInTheDocument();
    // Actividades: actual 6, anterior 2, Δ +4.
    expect(screen.getAllByText("6").length).toBeGreaterThan(0); // events actual y people actual/anterior comparten cifra
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("+4")).toBeInTheDocument();
    // Personas: Δ 0 (comparte cifra con delta.events de la fila suprimida, ver test siguiente).
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    // % asistencia: actual y anterior 100,0 %, Δ 0,0 %.
    expect(screen.getAllByText("100,0 %").length).toBe(2);
    expect(screen.getByText("0,0 %")).toBeInTheDocument();
  });

  it("fila suprimida: current/previous de Personas y % asistencia en «<5», Δ «—» anunciado como no disponible", () => {
    render(<ComparativaTable data={buildCompareResponse()} />);

    expect(screen.getByText("Donostialdea")).toBeInTheDocument();
    // Personas actual/anterior + % asistencia actual/anterior: cuatro celdas en '<5'.
    expect(screen.getAllByText("<5").length).toBe(4);
    // El «—» lleva un rol con nombre accesible propio: un `aria-label`
    // suelto sobre un `<span>` genérico no lo anuncia ningún lector.
    const notAvailable = screen.getAllByRole("img", { name: "No disponible por umbral de agregación" });
    expect(notAvailable).toHaveLength(2); // Personas (Δ) y % asistencia (Δ).
    notAvailable.forEach((el) => expect(el).toHaveTextContent("—"));
  });

  it("Actividades (Δ) de la fila suprimida sigue siendo un número real (los eventos nunca se suprimen)", () => {
    render(<ComparativaTable data={buildCompareResponse()} />);

    // Fila Donostialdea: current.events=1, previous.events=1, delta.events=0 (nunca '—').
    expect(screen.getAllByText("1").length).toBe(2);
  });

  it("tabla sin filas: solo cabecera, sin romper", () => {
    render(<ComparativaTable data={buildCompareResponse({ rows: [] })} />);

    expect(screen.getByText("Ámbito")).toBeInTheDocument();
    expect(screen.queryByText("Bidasoa")).not.toBeInTheDocument();
  });
});
