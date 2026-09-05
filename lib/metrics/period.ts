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
 *
 * **«Plurianual» (tarea B2, Fase 6, memoria plurianual)**: el brief pedía
 * literalmente «últimos 3 años naturales completos + el actual», pero
 * `panel/viewsets.py::_periodo` (backend) aplica el mismo tope duro de
 * 366 días a `since`/`until` en **todas** las rutas (métricas, export,
 * compare), sin ninguna excepción para `group_by=year` — confirmado
 * leyendo el código real, no solo `docs/PANEL.md` §1.2/§11.1. Tocar 4
 * años naturales distintos (los 3 anteriores + el actual) exige como
 * mínimo pisar un día de cada uno, y el mínimo posible para eso son
 * ~3 años completos (>1000 días): matemáticamente incompatible con el
 * límite de 366 días de una sola petición. Dentro de esa cota, la
 * ventana que más años naturales distintos puede rozar son 2 (un tramo
 * que cruza un 1 de enero). `presetPeriod('plurianual')` usa por tanto
 * la ventana más ancha que sigue pasando `validatePeriod` de este mismo
 * módulo y el tope real del backend (365 días de calendario hasta hoy)
 * en vez del literal del brief — la única forma de mostrar de verdad
 * `group_by=year` con más de un año en una sola petición. Una memoria de
 * 3+ años real exigiría varias peticiones fusionadas en el cliente,
 * fuera del alcance de los ficheros que toca esta tarea (ver el informe
 * de la tarea para más detalle).
 */

export type PeriodPreset = "mes" | "trimestre" | "anio" | "plurianual" | "personalizado";

export interface Period {
  since: string;
  until: string;
}

export type PeriodValidationError = "fecha_invalida" | "rango_invertido" | "periodo_demasiado_largo";

const MAX_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** También la usa `hooks/useEntityHome.ts` para «las actividades de hoy». */
export function toIso(date: Date): string {
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
    case "plurianual": {
      // `MAX_DAYS` días exactos dispararía la validación de longitud de
      // este mismo módulo (`validatePeriod` cuenta días inclusive,
      // `MAX_DAYS + 1` en total): un día menos, en aritmética de días de
      // calendario (nunca de meses, para no depender de si el tramo cruza
      // un 29 de febrero), es la ventana más ancha que sigue pasando esa
      // validación y el tope real del backend.
      const start = new Date(today.getTime());
      start.setDate(start.getDate() - (MAX_DAYS - 1));
      return { since: toIso(start), until };
    }
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
