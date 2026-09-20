import type { PlaceRow, PlaceSheet } from "@/lib/api/types";

/** Municipio real del ejemplo de la spec §3.2 (Irun, Gipuzkoa). */
export function buildPlaceRow(overrides: Partial<PlaceRow> = {}): PlaceRow {
  return {
    ine_code: "20069",
    name: "Irun",
    name_local: "Irun",
    comarca_code: "C1",
    comarca_name_es: "Bidasoa",
    comarca_name_eu: "Bidasoa",
    prov_code: "20",
    prov_name: "Gipuzkoa",
    ccaa_code: "16",
    ccaa_name: "País Vasco",
    latitude: 43.34,
    longitude: -1.79,
    ...overrides,
  };
}

/** Ficha de municipio del ejemplo de la spec §3.2 (personas suprimidas). */
export function buildPlaceSheet(overrides: Partial<PlaceSheet> = {}): PlaceSheet {
  return {
    place: {
      ine_code: "20069",
      name: "Irun",
      name_local: "Irun",
      comarca_name_es: "Bidasoa",
      comarca_name_eu: "Bidasoa",
      prov_name: "Gipuzkoa",
      latitude: 43.34,
      longitude: -1.79,
    },
    events: { held: 12, upcoming: 3 },
    people: { value: null, suppressed: true },
    attendance: { rate: 0.71, suppressed: false },
    communities: { count: 4 },
    organizations_based_here: 2,
    ...overrides,
  };
}
