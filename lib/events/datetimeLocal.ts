/**
 * Conversión entre el valor de un `<input type="datetime-local">` (sin
 * zona horaria, `"YYYY-MM-DDTHH:mm"`, interpretado por el motor JS como
 * **hora local** — a diferencia de una fecha sin hora, que se interpreta
 * como UTC) y el ISO 8601 con zona que espera el backend
 * (`starts_at`/`ends_at`, `docs/PANEL.md` §3.4).
 *
 * `ActividadForm.tsx` los usa para que quien teclea vea siempre su propia
 * hora local, sea cual sea la del servidor.
 */

/** `localInputToIso("2026-09-25T14:30") → "2026-09-25T12:30:00.000Z"` (con UTC+2). Cadena vacía o ilegible → `""`. */
export function localInputToIso(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/** Camino inverso: un ISO del backend a `"YYYY-MM-DDTHH:mm"` en hora local. Vacío/ilegible → `""`. */
export function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
    parsed.getHours(),
  )}:${pad(parsed.getMinutes())}`;
}
