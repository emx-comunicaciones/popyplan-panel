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
 *
 * El signo se decide sobre el valor **ya redondeado a la décima** que se
 * va a pintar: una diferencia de -0,01 puntos se pinta «0,0 %», nunca
 * «-0,0 %» (un signo delante de un cero se lee como una bajada real que
 * no existe, y es el caso habitual de dos periodos prácticamente
 * iguales).
 */
export function formatDeltaPct(value: number | null, suppressed: boolean): string {
  if (suppressed || value === null) return DELTA_NOT_AVAILABLE;
  const points = Math.round(value * 100 * 10) / 10;
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
 * `"YYYY-MM-DD"`). El año va siempre en la fecha final y **solo** en la
 * inicial cuando el periodo cruza el cambio de año: con los presets
 * «Año» y «Plurianual» las dos fechas caen en años distintos, y omitir
 * el de la inicial hacía leer un periodo de un año («frente a 17 sept –
 * 17 sept 2025») como si fuera de un día.
 */
export function previousPeriodLabel(previous: { since: string; until: string }): string {
  const sinceDate = new Date(`${previous.since}T00:00:00Z`);
  const untilDate = new Date(`${previous.until}T00:00:00Z`);
  const sameYear = sinceDate.getUTCFullYear() === untilDate.getUTCFullYear();
  const since = (sameYear ? SHORT_DATE : SHORT_DATE_WITH_YEAR).format(sinceDate);
  const until = SHORT_DATE_WITH_YEAR.format(untilDate);
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
