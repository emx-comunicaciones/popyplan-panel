import type { ByPlaceRow, CompareResponse, MetricsResponse, SeriesRow } from "@/lib/api/types";

/**
 * Fixture base: el ejemplo real de `docs/PANEL.md` §1.4 (entidad "hija"
 * del escenario `panel/tests/conftest.py::escenario_metrics`, periodo
 * 2026-01-01/2026-01-31, `nominal=True`).
 */
export function buildMetricsResponse(overrides: Partial<MetricsResponse> = {}): MetricsResponse {
  return {
    people: { active: 11, new: 1, repeating: 1, suppressed: false },
    events: {
      held: 4,
      cancelled: 1,
      by_audience: { anyone: 3, community: 1, organization: 0 },
    },
    attendance: {
      registered: 2,
      attended: 8,
      no_show: 3,
      rate: 0.7272727272727273,
      suppressed: false,
    },
    communities: { active: 2, members: 4, suppressed: false },
    by_place: [],
    by_weekday_hour: [],
    series: [],
    ...overrides,
  };
}

/** Filas «por municipio» del mismo ejemplo (`group_by=place`): una suprimida. */
export function buildByPlaceRows(): ByPlaceRow[] {
  return [
    { key: "30001", label: "Alfaville", events: 3, people: 5, suppressed: false },
    { key: "30002", label: "Betaville", events: 1, people: null, suppressed: true },
  ];
}

/** Filas «por entidad» (`group_by=organization`), para el panel de paraguas. */
export function buildByOrganizationRows(): ByPlaceRow[] {
  return [
    { key: "8", label: "Asociación Hija Uno", events: 3, people: 6, suppressed: false },
    { key: "9", label: "Asociación Hija Dos", events: 1, people: null, suppressed: true },
  ];
}

/** Serie mensual (`group_by=month`), ejemplo de `docs/PANEL.md` §1.4. */
export function buildSeriesRows(): SeriesRow[] {
  return [{ month: "2026-01", events: 4, people: 8, suppressed: false }];
}

/** Serie anual (`group_by=year`, memoria plurianual, `docs/PANEL.md` §11.4). */
export function buildYearSeriesRows(): SeriesRow[] {
  return [
    { year: "2025", events: 5, people: 13, suppressed: false },
    { year: "2026", events: 6, people: 6, suppressed: false },
  ];
}

/**
 * Ejemplo real de `docs/PANEL.md` §11.3 (`compare_for`, tarea B2): una
 * fila sin suprimir (comarca Bidasoa) y una suprimida (Donostialdea, por
 * debajo del umbral en ambos periodos, `delta` también suprimido).
 */
export function buildCompareResponse(overrides: Partial<CompareResponse> = {}): CompareResponse {
  return {
    current: { since: "2026-04-01", until: "2026-06-30" },
    previous: { since: "2025-12-31", until: "2026-03-31" },
    group_by: "comarca",
    rows: [
      {
        key: "C1",
        label: "Bidasoa",
        current: { events: 6, people: 6, attendance_rate: 1.0, suppressed: false },
        previous: { events: 2, people: 6, attendance_rate: 1.0, suppressed: false },
        delta: { events: 4, people: 0, attendance_rate: 0.0, suppressed: false },
      },
      {
        key: "C2",
        label: "Donostialdea",
        current: { events: 1, people: null, attendance_rate: null, suppressed: true },
        previous: { events: 1, people: null, attendance_rate: null, suppressed: true },
        delta: { events: 0, people: null, attendance_rate: null, suppressed: true },
      },
    ],
    ...overrides,
  };
}
