import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { MAX_RADIUS, type MapBubble } from "@/lib/metrics/mapScale";

import { TerritoryMap } from "./TerritoryMap";

const BUBBLES: MapBubble[] = [
  {
    ineCode: "20069",
    label: "Irun",
    latitude: 43.34,
    longitude: -1.79,
    radius: MAX_RADIUS,
    color: "var(--color-primary-700)",
    events: 12,
    people: 30,
    suppressed: false,
  },
  {
    ineCode: "20045",
    label: "Hondarribia",
    latitude: 43.36,
    longitude: -1.79,
    radius: 10,
    color: "var(--color-text-disabled)",
    events: 3,
    people: null,
    suppressed: true,
  },
];

describe("TerritoryMap", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<TerritoryMap bubbles={BUBBLES} onSelect={vi.fn()} />);

    expect(await screen.findByRole("img", { name: /Mapa del territorio/ })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("describe el mapa con el número de municipios con actividad", async () => {
    render(<TerritoryMap bubbles={BUBBLES} onSelect={vi.fn()} />);

    expect(
      await screen.findByRole("img", {
        name: "Mapa del territorio: 2 municipios con actividad en el periodo",
      }),
    ).toBeInTheDocument();
  });

  it("pinta una burbuja por municipio, con la cifra suprimida como «<5»", async () => {
    render(<TerritoryMap bubbles={BUBBLES} onSelect={vi.fn()} />);

    expect(await screen.findByText("Irun: 12 actividades, 30 personas")).toBeInTheDocument();
    expect(screen.getByText("Hondarribia: 3 actividades, <5 personas")).toBeInTheDocument();
  });

  it("pulsar una burbuja pide abrir la ficha de ese municipio", async () => {
    const onSelect = vi.fn();
    render(<TerritoryMap bubbles={BUBBLES} onSelect={onSelect} />);

    await userEvent.click(await screen.findByRole("button", { name: /^Irun:/ }));

    expect(onSelect).toHaveBeenCalledWith("20069");
  });

  it("sin burbujas avisa en vez de pintar un mapa vacío", async () => {
    render(<TerritoryMap bubbles={[]} onSelect={vi.fn()} />);

    expect(
      await screen.findByText("Ningún municipio del territorio tiene actividad en este periodo."),
    ).toBeInTheDocument();
  });
});
