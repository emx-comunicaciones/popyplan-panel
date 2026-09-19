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
 *
 * **Idioma del formateador** (tarea 5 de i18n, mismo patrón que
 * `lib/metrics/format.ts`): los formateadores de número y fecha salen de
 * `lib/i18n/locale.ts`, cacheados por idioma. `previousPeriodLabel` ya no
 * construye el prefijo «frente a» él mismo (es texto de UI: solo un
 * componente con `t()` puede traducirlo) — recibe ese prefijo ya
 * traducido como segundo argumento y solo compone el rango de fechas.
 */
import { activeLanguage, localeFor } from "@/lib/i18n/locale";

const deltaIntegerFormatters = new Map<string, Intl.NumberFormat>();
function deltaIntegerFormatter(): Intl.NumberFormat {
  const locale = localeFor(activeLanguage());
  let formatter = deltaIntegerFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      useGrouping: "always",
    });
    deltaIntegerFormatters.set(locale, formatter);
  }
  return formatter;
}

const deltaPercentFormatters = new Map<string, Intl.NumberFormat>();
function deltaPercentFormatter(): Intl.NumberFormat {
  const locale = localeFor(activeLanguage());
  let formatter = deltaPercentFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    deltaPercentFormatters.set(locale, formatter);
  }
  return formatter;
}

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
  return `${sign}${deltaIntegerFormatter().format(Math.abs(value))}`;
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
  if (points === 0) return `${deltaPercentFormatter().format(0)} %`;
  const sign = points > 0 ? "+" : "-";
  return `${sign}${deltaPercentFormatter().format(Math.abs(points))} %`;
}

const shortDateFormatters = new Map<string, Intl.DateTimeFormat>();
function shortDateFormatter(): Intl.DateTimeFormat {
  const locale = localeFor(activeLanguage());
  let formatter = shortDateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    shortDateFormatters.set(locale, formatter);
  }
  return formatter;
}

const shortDateWithYearFormatters = new Map<string, Intl.DateTimeFormat>();
function shortDateWithYearFormatter(): Intl.DateTimeFormat {
  const locale = localeFor(activeLanguage());
  let formatter = shortDateWithYearFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    shortDateWithYearFormatters.set(locale, formatter);
  }
  return formatter;
}

/**
 * «frente a 1 ene – 31 mar 2026»: leyenda del periodo anterior con el que
 * se compara el actual (`docs/PANEL.md` §11.3, `previous.since`/`.until`,
 * `"YYYY-MM-DD"`). El año va siempre en la fecha final y **solo** en la
 * inicial cuando el periodo cruza el cambio de año: con los presets
 * «Año» y «Plurianual» las dos fechas caen en años distintos, y omitir
 * el de la inicial hacía leer un periodo de un año («frente a 17 sept –
 * 17 sept 2025») como si fuera de un día.
 *
 * **`prefix`** (tarea 5 de i18n): esta función es `.ts` plano — no puede
 * llamar a `t()` — así que quien llama (`ComparativaTable.tsx`) le pasa
 * el equivalente ya traducido de «frente a»
 * (`t("metrics.comparativa.previousPeriodPrefix")`); la función solo
 * compone `"<prefix> <rango>"`.
 */
export function previousPeriodLabel(
  previous: { since: string; until: string },
  prefix: string,
): string {
  const sinceDate = new Date(`${previous.since}T00:00:00Z`);
  const untilDate = new Date(`${previous.until}T00:00:00Z`);
  const sameYear = sinceDate.getUTCFullYear() === untilDate.getUTCFullYear();
  const since = (sameYear ? shortDateFormatter() : shortDateWithYearFormatter()).format(sinceDate);
  const until = shortDateWithYearFormatter().format(untilDate);
  return `${prefix} ${since} – ${until}`;
}

const GROUP_BY_KEYS: Record<string, string> = {
  comarca: "metrics.groupBy.comarca",
  organization: "metrics.groupBy.organization",
  place: "metrics.groupBy.place",
  province: "metrics.groupBy.province",
};

/**
 * Clave de traducción del nombre del desglose (`comarca`/`organization`/
 * `place`/`province`), para el `<caption>` de la tabla — `null` para un
 * valor que el backend añadiera y este módulo no conozca todavía (quien
 * llama cae entonces al valor crudo, mismo patrón defensivo que
 * `relationshipLabelKey`/`reasonLabelKey`).
 */
export function groupByLabelKey(groupBy: string): string | null {
  return GROUP_BY_KEYS[groupBy] ?? null;
}
