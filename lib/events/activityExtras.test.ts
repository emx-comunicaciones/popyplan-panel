import { describe, expect, it } from "vitest";

import {
  CUSTOM_CATEGORY_MAX_LENGTH,
  EVENT_AGE_MAX_INVALID_ERROR_KEY,
  EVENT_AGE_MIN_INVALID_ERROR_KEY,
  EVENT_AGES_ORDER_ERROR_KEY,
  EVENT_COST_INVALID_ERROR_KEY,
  EVENT_CUSTOM_CATEGORY_ERROR_KEY,
  EVENT_STOP_NAME_ERROR_KEY,
  EVENT_TRIP_END_REQUIRED_ERROR_KEY,
  MAX_STOPS,
  OTHER_CATEGORY,
  ageToApi,
  categoryToApi,
  costFromApi,
  costToApi,
  isoToDateInput,
  moveStop,
  normalizeCustomCategory,
  stopsFromApi,
  stopsToApi,
  tripEndIso,
  tripStartIso,
  validateCustomCategory,
  validateEventAges,
  validateEventCost,
  validateStops,
  validateTripEnd,
} from "./activityExtras";

describe("categoría", () => {
  it("normaliza la escrita a mano: recorta y deja un solo espacio", () => {
    expect(normalizeCustomCategory("  Juegos   tradicionales ")).toBe("Juegos tradicionales");
  });

  it("«Otra» exige escribirla; con una del catálogo es opcional", () => {
    expect(validateCustomCategory(OTHER_CATEGORY, "   ")).toBe(EVENT_CUSTOM_CATEGORY_ERROR_KEY);
    expect(validateCustomCategory(OTHER_CATEGORY, "Parchís")).toBeNull();
    expect(validateCustomCategory("3", "")).toBeNull();
    expect(validateCustomCategory("", "")).toBeNull();
  });

  it("no pasa de 60 caracteres (tras normalizar)", () => {
    const larga = "a".repeat(CUSTOM_CATEGORY_MAX_LENGTH + 1);
    expect(validateCustomCategory("3", larga)).toBe(EVENT_CUSTOM_CATEGORY_ERROR_KEY);
    expect(validateCustomCategory("3", ` ${"a".repeat(CUSTOM_CATEGORY_MAX_LENGTH)} `)).toBeNull();
  });

  it("«Otra» y «ninguna» viajan como null; una del catálogo, como número", () => {
    expect(categoryToApi(OTHER_CATEGORY)).toBeNull();
    expect(categoryToApi("")).toBeNull();
    expect(categoryToApi("7")).toBe(7);
  });
});

describe("coste", () => {
  it("sin coste siempre es válido", () => {
    expect(validateEventCost(false, "abc")).toBeNull();
  });

  it("con coste exige un importe > 0, con 2 decimales y 6 cifras enteras como mucho", () => {
    expect(validateEventCost(true, "")).toBe(EVENT_COST_INVALID_ERROR_KEY);
    expect(validateEventCost(true, "0")).toBe(EVENT_COST_INVALID_ERROR_KEY);
    expect(validateEventCost(true, "-3")).toBe(EVENT_COST_INVALID_ERROR_KEY);
    expect(validateEventCost(true, "12.555")).toBe(EVENT_COST_INVALID_ERROR_KEY);
    expect(validateEventCost(true, "1234567")).toBe(EVENT_COST_INVALID_ERROR_KEY);
    expect(validateEventCost(true, "12,5")).toBeNull();
    expect(validateEventCost(true, "999999.99")).toBeNull();
  });

  it("viaja como la cadena decimal de DRF, o null si no tiene coste", () => {
    expect(costToApi(true, "12,5")).toBe("12.50");
    expect(costToApi(true, "7")).toBe("7.00");
    expect(costToApi(false, "7")).toBeNull();
  });

  it("al editar, un coste guardado de 0 o vacío es «sin coste»", () => {
    expect(costFromApi("12.50")).toEqual({ hasCost: true, text: "12.50" });
    expect(costFromApi("0.00")).toEqual({ hasCost: false, text: "" });
    expect(costFromApi(null)).toEqual({ hasCost: false, text: "" });
    expect(costFromApi(undefined)).toEqual({ hasCost: false, text: "" });
  });
});

describe("edades", () => {
  it("vacías son válidas (sin límite)", () => {
    expect(validateEventAges("", "")).toBeNull();
  });

  it("cada una entre 18 y 120, entera", () => {
    expect(validateEventAges("17", "")).toBe(EVENT_AGE_MIN_INVALID_ERROR_KEY);
    expect(validateEventAges("18.5", "")).toBe(EVENT_AGE_MIN_INVALID_ERROR_KEY);
    expect(validateEventAges("", "121")).toBe(EVENT_AGE_MAX_INVALID_ERROR_KEY);
    expect(validateEventAges("18", "120")).toBeNull();
  });

  it("la mínima no puede ser mayor que la máxima", () => {
    expect(validateEventAges("40", "30")).toBe(EVENT_AGES_ORDER_ERROR_KEY);
    expect(validateEventAges("30", "30")).toBeNull();
  });

  it("viajan como número o null", () => {
    expect(ageToApi(" 30 ")).toBe(30);
    expect(ageToApi("")).toBeNull();
  });
});

describe("fechas de un viaje", () => {
  it("el inicio es ese día a las 00:00 locales y el final a las 23:59:59", () => {
    expect(new Date(tripStartIso("2026-11-12")).getTime()).toBe(
      new Date(2026, 10, 12, 0, 0, 0).getTime(),
    );
    expect(new Date(tripEndIso("2026-11-14")).getTime()).toBe(
      new Date(2026, 10, 14, 23, 59, 59).getTime(),
    );
  });

  it("un día vacío o que no existe da cadena vacía", () => {
    expect(tripStartIso("")).toBe("");
    expect(tripEndIso("2026-02-30")).toBe("");
  });

  it("un ISO guardado se lee como su día local", () => {
    const iso = new Date(2026, 10, 12, 0, 0, 0).toISOString();
    expect(isoToDateInput(iso)).toBe("2026-11-12");
    expect(isoToDateInput(null)).toBe("");
    expect(isoToDateInput("no")).toBe("");
  });

  it("un viaje necesita día final", () => {
    expect(validateTripEnd(true, "")).toBe(EVENT_TRIP_END_REQUIRED_ERROR_KEY);
    expect(validateTripEnd(true, "2026-11-14")).toBeNull();
    expect(validateTripEnd(false, "")).toBeNull();
  });
});

describe("paradas", () => {
  const guardadas = [
    { id: "a", order: 0, name: "Bilbao", latitude: "43.263000", longitude: "-2.935000", address: "Plaza" },
    { id: "b", order: 1, name: "Burgos", latitude: null, longitude: null, address: "" },
  ];

  it("se leen del detalle conservando id y coordenadas", () => {
    const paradas = stopsFromApi(guardadas);
    expect(paradas.map((p) => [p.id, p.name, p.address, p.latitude])).toEqual([
      ["a", "Bilbao", "Plaza", "43.263000"],
      ["b", "Burgos", "", null],
    ]);
    expect(new Set(paradas.map((p) => p.key)).size).toBe(2);
    expect(stopsFromApi(undefined)).toEqual([]);
  });

  it("se mandan en orden, con su id y sin perder las coordenadas que puso la app", () => {
    const paradas = stopsFromApi(guardadas);
    paradas.push({ key: "nueva", name: "  León ", address: " ", latitude: null, longitude: null });
    expect(stopsToApi(paradas)).toEqual([
      { id: "a", name: "Bilbao", address: "Plaza", latitude: "43.263000", longitude: "-2.935000" },
      { id: "b", name: "Burgos", address: "" },
      { name: "León", address: "" },
    ]);
  });

  it("cada parada necesita nombre (máx. 120) y la dirección no pasa de 200", () => {
    const base = { key: "k", latitude: null, longitude: null };
    expect(validateStops([{ ...base, name: "Bilbao", address: "" }])).toBeNull();
    expect(validateStops([{ ...base, name: "  ", address: "" }])).toBe(EVENT_STOP_NAME_ERROR_KEY);
    expect(validateStops([{ ...base, name: "a".repeat(121), address: "" }])).toBe(
      EVENT_STOP_NAME_ERROR_KEY,
    );
    expect(validateStops([{ ...base, name: "Bilbao", address: "a".repeat(201) }])).toBe(
      EVENT_STOP_NAME_ERROR_KEY,
    );
    expect(MAX_STOPS).toBe(30);
  });

  it("se mueven arriba y abajo sin salirse de la lista", () => {
    const paradas = stopsFromApi(guardadas);
    expect(moveStop(paradas, 1, -1).map((p) => p.name)).toEqual(["Burgos", "Bilbao"]);
    expect(moveStop(paradas, 0, -1)).toBe(paradas);
    expect(moveStop(paradas, 1, 1)).toBe(paradas);
  });
});
