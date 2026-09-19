import { describe, expect, it } from "vitest";

import { buildPlaceRow } from "@/test-utils/fixtures/places";

import {
  MAX_RADIUS,
  MIN_RADIUS,
  SUPPRESSED_COLOR,
  bubbleColor,
  bubbleRadius,
  toBubbles,
  toFiniteNumber,
} from "./mapScale";

describe("toFiniteNumber", () => {
  it("acepta números y cadenas numéricas (DRF puede serializar decimales como texto)", () => {
    expect(toFiniteNumber(43.34)).toBe(43.34);
    expect(toFiniteNumber("-1.79")).toBe(-1.79);
  });

  it("rechaza null, cadena vacía, texto y no finitos", () => {
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber("")).toBeNull();
    expect(toFiniteNumber("norte")).toBeNull();
    expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("bubbleRadius", () => {
  it("el municipio con más actividades ocupa el radio máximo", () => {
    expect(bubbleRadius(12, 12)).toBe(MAX_RADIUS);
  });

  it("sin actividades se queda en el radio mínimo", () => {
    expect(bubbleRadius(0, 12)).toBe(MIN_RADIUS);
  });

  it("escala por área, no por radio: la mitad de actividades no es la mitad de radio", () => {
    const half = bubbleRadius(6, 12);
    expect(half).toBeGreaterThan(MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) / 2 - 0.001);
    expect(half).toBeLessThan(MAX_RADIUS);
  });

  it("un máximo inválido no rompe la escala", () => {
    expect(bubbleRadius(4, 0)).toBe(MAX_RADIUS);
    expect(bubbleRadius(Number.NaN, 12)).toBe(MIN_RADIUS);
  });
});

describe("bubbleColor", () => {
  it("una celda suprimida se pinta en gris", () => {
    expect(bubbleColor(null, true, 30)).toBe(SUPPRESSED_COLOR);
  });

  it("una celda sin dato también se pinta en gris", () => {
    expect(bubbleColor(null, false, 30)).toBe(SUPPRESSED_COLOR);
  });

  it("más personas, tono más intenso de la marca", () => {
    const low = bubbleColor(1, false, 30);
    const high = bubbleColor(30, false, 30);
    expect(low).not.toBe(high);
    expect(high).toBe("var(--color-primary-700)");
    expect(low).toBe("var(--color-primary-100)");
  });
});

describe("toBubbles", () => {
  const rows = [
    { key: "20069", label: "Irun", events: 12, people: 30, suppressed: false },
    { key: "20045", label: "Hondarribia", events: 3, people: null, suppressed: true },
  ];

  it("une cada fila con sus coordenadas y calcula radio y color", () => {
    const places = [
      buildPlaceRow(),
      buildPlaceRow({ ine_code: "20045", name: "Hondarribia", latitude: 43.36, longitude: -1.79 }),
    ];

    expect(toBubbles(rows, places)).toEqual([
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
        radius: bubbleRadius(3, 12),
        color: SUPPRESSED_COLOR,
        events: 3,
        people: null,
        suppressed: true,
      },
    ]);
  });

  it("descarta las filas sin municipio conocido o sin coordenadas", () => {
    const places = [buildPlaceRow({ latitude: null })];

    expect(toBubbles(rows, places)).toEqual([]);
  });
});
