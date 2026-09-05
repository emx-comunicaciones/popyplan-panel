/**
 * Periodos del panel de métricas (`docs/PANEL.md` §1.2): `since`/`until`
 * ISO (`YYYY-MM-DD`), ambas inclusive. El backend rechaza con 400 un
 * `since > until` o un periodo de más de 366 días; este módulo valida lo
 * mismo en el cliente para no lanzar una petición que sabemos que va a
 * fallar y para dar el mensaje en español antes de tocar la red.
 *
 * Presets pedidos por la tarea W2: «este mes» (desde el día 1 del mes en
 * curso hasta hoy), «trimestre» (últimos 3 meses hasta hoy) y «año»
 * (últimos 12 meses hasta hoy — cae justo en el límite de 366 días del
 * backend, así que nunca hace falta un caso especial de años bisiestos
 * para que pase la validación). «Personalizado» son las fechas que
 * escribe quien usa el panel, validadas con la misma regla.
 */

export type PeriodPreset = "mes" | "trimestre" | "anio" | "personalizado";

export interface Period {
  since: string;
  until: string;
}

export type PeriodValidationError = "fecha_invalida" | "rango_invertido" | "periodo_demasiado_largo";

const MAX_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setMonth(result.getMonth() - months);
  return result;
}

/** Presets fijos (todo menos «personalizado», que no tiene una fórmula). */
export function presetPeriod(
  preset: Exclude<PeriodPreset, "personalizado">,
  today: Date = new Date(),
): Period {
  const until = toIso(today);
  switch (preset) {
    case "mes": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { since: toIso(start), until };
    }
    case "trimestre":
      return { since: toIso(subtractMonths(today, 3)), until };
    case "anio":
      return { since: toIso(subtractMonths(today, 12)), until };
  }
}

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Misma regla que `docs/PANEL.md` §1.2: fecha inválida, rango invertido o > 366 días. */
export function validatePeriod(since: string, until: string): PeriodValidationError | null {
  const sinceDate = parseIsoDate(since);
  const untilDate = parseIsoDate(until);
  if (!sinceDate || !untilDate) return "fecha_invalida";
  if (sinceDate.getTime() > untilDate.getTime()) return "rango_invertido";
  const days = Math.round((untilDate.getTime() - sinceDate.getTime()) / MS_PER_DAY) + 1;
  if (days > MAX_DAYS) return "periodo_demasiado_largo";
  return null;
}

export type CustomPeriodResult =
  | { period: Period; error: null }
  | { period: null; error: PeriodValidationError };

/** Construye un periodo «personalizado» validado, o el error a mostrar. */
export function customPeriod(since: string, until: string): CustomPeriodResult {
  const error = validatePeriod(since, until);
  if (error) return { period: null, error };
  return { period: { since, until }, error: null };
}
