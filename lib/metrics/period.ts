/**
 * Periodos del panel de métricas (`docs/PANEL.md` §1.2): `since`/`until`
 * ISO (`YYYY-MM-DD`), ambas inclusive. El backend rechaza con 400 un
 * `since > until` o un periodo de más de `PERIODO_MAX_DIAS = 1461` días
 * (~4 años); este módulo valida lo mismo en el cliente para no lanzar
 * una petición que sabemos que va a fallar y para dar el mensaje en
 * español antes de tocar la red.
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
      // `MAX_DAYS = 1461` (~4 años) esto siempre valida: el tramo más
      // ancho posible (1 de enero hasta el 31 de diciembre, 4 años
      // completos) son como mucho 1462 días con un bisiesto de más —
      // en la práctica, `until = hoy` siempre recorta por debajo del 31
      // de diciembre del año en curso, así que nunca llega a ese máximo.
      const start = new Date(today.getFullYear() - 3, 0, 1);
      return { since: toIso(start), until };
    }
  }
}

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Misma regla que `docs/PANEL.md` §1.2: fecha inválida, rango invertido o > 1461 días. */
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
