/**
 * Formateo de la comparativa (`GET /api/panel/{paraguas,plataforma}/compare/`,
 * `docs/PANEL.md` §11, tarea B2). Las celdas `current`/`previous` de cada
 * fila comparten la forma de una celda suprimible normal (`{value,
 * suppressed}`), así que reutilizan tal cual `formatCount`/`formatPct`
 * de `lib/metrics/format.ts` — este módulo solo añade lo que es propio de
 * la comparativa: el signo del `delta` (nunca «<5»: una diferencia
 * suprimida es «no disponible», no «menos de 5», así que se pinta «—»,
 * nunca el texto de `formatCount`) y la leyenda legible del periodo
 * anterior.
 */

const DELTA_INTEGER_FORMATTER = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  useGrouping: "always",
});
const DELTA_PERCENT_FORMATTER = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Cadena que pinta una celda de `delta` cuando `suppressed` (nunca «<5», ver arriba). */
export const DELTA_NOT_AVAILABLE = "—";

/**
 * `formatDeltaCount(4) → '+4'`; `formatDeltaCount(-2) → '-2'`;
 * `formatDeltaCount(0) → '0'`; `formatDeltaCount(null, true) → '—'`
 * (celda suprimida: cualquiera de los dos periodos de la fila estaba por
 * debajo del umbral, `docs/PANEL.md` §11.3).
 */
export function formatDeltaCount(value: number | null, suppressed: boolean): string {
  if (suppressed || value === null) return DELTA_NOT_AVAILABLE;
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${DELTA_INTEGER_FORMATTER.format(Math.abs(value))}`;
}

/**
 * `formatDeltaPct(0.05) → '+5,0 %'`; `formatDeltaPct(-0.02) → '-2,0 %'`;
 * `formatDeltaPct(null, true) → '—'`.
 */
export function formatDeltaPct(value: number | null, suppressed: boolean): string {
  if (suppressed || value === null) return DELTA_NOT_AVAILABLE;
  const points = value * 100;
  if (points === 0) return `${DELTA_PERCENT_FORMATTER.format(0)} %`;
  const sign = points > 0 ? "+" : "-";
  return `${sign}${DELTA_PERCENT_FORMATTER.format(Math.abs(points))} %`;
}

const SHORT_DATE = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const SHORT_DATE_WITH_YEAR = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * «frente a 1 ene – 31 mar 2026»: leyenda del periodo anterior con el que
 * se compara el actual (`docs/PANEL.md` §11.3, `previous.since`/`.until`,
 * `"YYYY-MM-DD"`). El año solo se repite en la fecha final, igual que en
 * el ejemplo del brief de esta tarea.
 */
export function previousPeriodLabel(previous: { since: string; until: string }): string {
  const since = SHORT_DATE.format(new Date(`${previous.since}T00:00:00Z`));
  const until = SHORT_DATE_WITH_YEAR.format(new Date(`${previous.until}T00:00:00Z`));
  return `frente a ${since} – ${until}`;
}

const GROUP_BY_LABELS: Record<string, string> = {
  comarca: "comarca",
  organization: "entidad",
  place: "municipio",
  province: "provincia",
};

/** Nombre en español del desglose (`comarca`/`organization`/`place`/`province`), para el `<caption>` de la tabla. */
export function groupByLabel(groupBy: string): string {
  return GROUP_BY_LABELS[groupBy] ?? groupBy;
}
