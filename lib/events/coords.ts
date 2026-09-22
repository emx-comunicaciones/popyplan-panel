/**
 * Formato de coordenada que espera el backend al crear/editar una
 * actividad (`Event.latitude`/`longitude`,
 * `DecimalField(max_digits=9, decimal_places=6)` — `events/models.py`).
 * DRF serializa y valida ese campo como cadena, y un `número.toString()`
 * de JS puede colarse con más de 6 decimales (arrastre de coma flotante,
 * `0.1 + 0.2 = 0.30000000000000004`) o con notación científica para
 * valores muy pequeños (`1e-7`) — el backend rechazaría los dos con
 * «Asegúrese de que no haya más de 9 dígitos en total».
 *
 * Mismo algoritmo que `popyplan-mobile/app/_utils/coords.ts
 * ::formatCoordinateForApi` (repo móvil, solo lectura): se reimplementa
 * aquí en vez de importarlo porque el panel y el móvil no comparten
 * paquete de utilidades.
 */
const MAX_DECIMALS = 6;
const MAX_TOTAL_DIGITS = 9;

/**
 * `formatCoordinateForApi(43.337753) → "43.337753"`. Un valor no finito
 * (nunca debería llegar desde `PlaceRow.latitude`/`longitude`, ya
 * filtrados por `lib/metrics/mapScale.ts` en otros consumidores, pero
 * defensivo aquí también) cae a `"0.000000"`.
 */
export function formatCoordinateForApi(coord: number): string {
  if (!Number.isFinite(coord)) return "0.000000";
  let fixed = coord.toFixed(MAX_DECIMALS);
  const [intPart] = fixed.split(".");
  const absIntDigits = intPart.replace("-", "").length;
  if (absIntDigits > MAX_TOTAL_DIGITS - MAX_DECIMALS) {
    const allowedDecimals = Math.max(0, MAX_TOTAL_DIGITS - absIntDigits);
    fixed = coord.toFixed(allowedDecimals);
  }
  return fixed;
}
