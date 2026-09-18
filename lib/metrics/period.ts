/**
 * Periodos del panel de métricas (`docs/PANEL.md` §1.2): `since`/`until`
 * ISO (`YYYY-MM-DD`), ambas inclusive. El backend rechaza con 400 un
 * `since > until` o un periodo cuya **diferencia** entre fechas supera
 * `PERIODO_MAX_DIAS = 1461` días (~4 años; `panel/viewsets.py::_periodo`
 * compara `(until - since).days`, así que un periodo de 1462 días
 * contando ambos extremos sí pasa); este módulo valida lo mismo en el
 * cliente, con la misma aritmética, para no lanzar una petición que
 * sabemos que va a fallar y para dar el mensaje en español antes de
 * tocar la red.
 *
 * Presets pedidos por la tarea W2: «este mes» (desde el día 1 del mes en
 * curso hasta hoy), «trimestre» (últimos 3 meses hasta hoy) y «año»
 * (últimos 12 meses hasta hoy). «Personalizado» son las fechas que
 * escribe quien usa el panel, validadas con la misma regla.
 *
 * **«Plurianual» (tarea B4/W2b, Fase 6, memoria plurianual)**: el brief
 * pide literalmente «los 3 años naturales completos anteriores + el año
 * en curso» (desde el 1 de enero de hace 3 años hasta hoy).
 * `panel/viewsets.py::_periodo` (backend) subió su tope de `since`/`until`
 * de 366 a `PERIODO_MAX_DIAS = 1461` días (~4 años) precisamente para
 * hacer esto posible en una sola petición — antes de esa subida, tocar 4
 * años naturales distintos era matemáticamente incompatible con el
 * límite de 366 días de una petición (como documentaba una versión
 * anterior de este comentario), y `presetPeriod('plurianual')` se
 * quedaba en una ventana de 365 días que como mucho rozaba 2 años.
 * `MAX_DAYS` de este módulo replica el nuevo tope del backend.
 */

export type PeriodPreset = "mes" | "trimestre" | "anio" | "plurianual" | "personalizado";

export interface Period {
  since: string;
  until: string;
}

export type PeriodValidationError = "fecha_invalida" | "rango_invertido" | "periodo_demasiado_largo";

const MAX_DAYS = 1461;
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
  // Clamp al último día del mes destino: `setMonth` rebalsa al mes
  // siguiente cuando el día de `date` no existe en destino (31-may →
  // 3-mar, perdiendo 2 días; 29-feb con «año» → 1-mar). Mientras el día
  // exista en destino se preserva (15-mar → 15-dic); si no, se clampa
  // al último día del mes destino en vez de rebalsar (31-may → 28-feb).
  const targetMonthLastDay = new Date(
    date.getFullYear(),
    date.getMonth() - months + 1,
    0,
  ).getDate();
  return new Date(
    date.getFullYear(),
    date.getMonth() - months,
    Math.min(date.getDate(), targetMonthLastDay),
  );
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
      // Los 3 años naturales completos anteriores + el año en curso:
      // desde el 1 de enero de hace 3 años hasta hoy. Con el tope de
      // `MAX_DAYS = 1461` (~4 años, sobre la diferencia entre fechas)
      // esto siempre valida: el tramo más ancho posible (1 de enero
      // hasta el 31 de diciembre, 4 años naturales con un bisiesto
      // dentro) son 1460 días de diferencia.
      const start = new Date(today.getFullYear() - 3, 0, 1);
      return { since: toIso(start), until };
    }
  }
}

/**
 * `new Date('2026-02-31T00:00:00Z')` no falla: rebalsa al 3 de marzo, y
 * el panel acabaría mandando al backend una fecha distinta de la que se
 * escribió. Se comprueba que la fecha resultante vuelve a dar el mismo
 * ISO que se pidió (el equivalente a que `date.fromisoformat` del
 * backend lance `ValueError` y `parse_date` devuelva `None` → 400). El
 * año 0000 pasa esa comprobación en JS pero no existe para Python
 * (`MINYEAR = 1`), así que se descarta aparte.
 */
function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // La fecha resultante tiene que ser, componente a componente, la que se
  // pidió: el patrón de arriba ya garantiza `YYYY-MM-DD` con ceros a la
  // izquierda, así que comparar el ISO de vuelta compara año, mes y día
  // de una vez.
  if (date.toISOString().slice(0, 10) !== value) return null;
  // El año 0 es una fecha válida en JS pero no existe en Python
  // (`MINYEAR = 1`), donde `parse_date` devolvería `None` → 400.
  if (date.getUTCFullYear() < 1) return null;
  return date;
}

/**
 * Misma regla que `panel/viewsets.py::_periodo`: fecha inválida, rango
 * invertido o una **diferencia** de más de `MAX_DAYS` días entre `since`
 * y `until` (`(until - since).days > PERIODO_MAX_DIAS`, no el número de
 * días del periodo contando ambos extremos — contarlos rechazaba en el
 * cliente periodos de 1462 días inclusive que el backend sí acepta, p.
 * ej. `2021-01-01..2025-01-01`).
 */
export function validatePeriod(since: string, until: string): PeriodValidationError | null {
  const sinceDate = parseIsoDate(since);
  const untilDate = parseIsoDate(until);
  if (!sinceDate || !untilDate) return "fecha_invalida";
  if (sinceDate.getTime() > untilDate.getTime()) return "rango_invertido";
  const days = Math.round((untilDate.getTime() - sinceDate.getTime()) / MS_PER_DAY);
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
