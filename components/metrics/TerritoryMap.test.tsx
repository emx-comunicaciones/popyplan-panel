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
    color: "#0e7c78",
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
    color: "#bdbdbd",
    events: 3,
    people: null,
    suppressed: true,
  },
];

describe("TerritoryMap", () => {
  // Tiene que ser el primer test del fichero, y sin `await`: `dynamic()`
  // de `next/dynamic` crea su `LoadableComponent` (con su `subscription`
  // de estado) una sola vez, a nivel de módulo, cuando se importa
  // `TerritoryMap.tsx` — algo que Vitest solo hace una vez por fichero de
  // test, no por `it()`. Una vez el `import()` diferido se resuelve en
  // cualquier test anterior, esa misma promesa resuelta queda cacheada
  // para todos los montajes siguientes del mismo fichero, así que un
  // `render()` posterior ya no pasa nunca por el estado «cargando». Este
  // test comprueba justo ese estado inicial, antes de que ningún otro se
  // adelante y lo resuelva.
  it("muestra un texto de carga mientras el mapa diferido se resuelve, nunca una caja vacía", () => {
    render(<TerritoryMap bubbles={BUBBLES} onSelect={vi.fn()} />);

    expect(screen.getByText("Cargando mapa…")).toBeInTheDocument();
  });

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

  it("desactiva el control de atribución de leaflet (evitaría una trampa de teclado dentro del role=img)", async () => {
    render(<TerritoryMap bubbles={BUBBLES} onSelect={vi.fn()} />);

    const mapContainer = await screen.findByTestId("map-container");
    expect(mapContainer.dataset.attributionControl).toBe("false");
  });

  it("pinta la atribución de OpenStreetMap fuera del área de imagen, como enlace real", async () => {
    render(<TerritoryMap bubbles={BUBBLES} onSelect={vi.fn()} />);

    const image = await screen.findByRole("img", { name: /Mapa del territorio/ });
    const link = screen.getByRole("link", { name: "Colaboradores de OpenStreetMap" });

    expect(image).not.toContainElement(link);
    expect(link).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  });
});
