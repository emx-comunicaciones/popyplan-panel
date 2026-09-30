import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { buildMetricsResponse } from "@/test-utils/fixtures/metrics";
import { HelpStats } from "./HelpStats";

describe("HelpStats", () => {
  it("pinta los servicios de la guardia del periodo", async () => {
    const { container } = render(<HelpStats help={buildMetricsResponse().help} />);
    expect(screen.getByRole("heading", { name: "Servicios de la guardia" })).toBeTruthy();
    const valor = (etiqueta: string) => screen.getByText(etiqueta).nextElementSibling?.textContent;
    expect(valor("Avisos recibidos")).toBe("5");
    expect(valor("Atendidos")).toBe("3");
    expect(valor("Sin atender")).toBe("2");
    expect(valor("Tiempo de respuesta (mediana)")).toBe("10 min");
    expect(valor("Personas a las que se escribió")).toBe("2");
    expect(valor("Referentes avisados")).toBe("1");
    expect(valor("Respondidos por la red de apoyo")).toBe("1");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("suprimida: todas las cifras salen «<5»", () => {
    render(
      <HelpStats
        help={{
          requests: null, people: null, attended: null, pending: null, contacted: null,
          referent_notified: null, network_responded: null, median_response_minutes: null,
          suppressed: true,
        }}
      />,
    );
    expect(screen.getAllByText("<5")).toHaveLength(8);
  });

  it("sin la sección (backend anterior), no pinta nada", () => {
    const { container } = render(<HelpStats help={undefined} />);
    expect(container.textContent).toBe("");
  });
});
