/**
 * Conversión entre el presupuesto que teclea quien usa el panel (euros,
 * con decimales, `ProgramaForm.tsx`) y `budget_cents` (`docs/PANEL.md`
 * §12.1, el backend solo guarda céntimos enteros). `eurosToCents`
 * redondea en vez de truncar tras multiplicar por 100, para no arrastrar
 * el error de coma flotante habitual (`19.99 * 100 === 1998.9999999999998`
 * en JS). `formatEuros` hace el camino inverso para pintar el presupuesto
 * ya guardado, formato es-ES (`docs/PANEL.md` §12: «presupuesto
 * formateado es-ES»).
 */

const EURO_FORMATTER = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  // Mismo motivo que `INTEGER_FORMATTER` de `lib/metrics/format.ts`: CLDR
  // reciente solo agrupa millares en es-ES a partir de 5 cifras
  // (`1234,56 €` sin punto, `12.345,67 €` con él) — forzar el
  // agrupamiento hace que un presupuesto de 4 cifras también lleve el
  // separador de millares, más legible y consistente con esa otra tabla.
  useGrouping: "always",
});

/** `formatEuros(123456) → '1.234,56 €'`. */
export function formatEuros(cents: number): string {
  return EURO_FORMATTER.format(cents / 100);
}

/**
 * `eurosToCents("19,99") → 1999`; acepta coma o punto decimal (el
 * `value` de un `<input type="number">` siempre usa punto, pero por si
 * llega de otro origen). Una cadena vacía o no numérica da `NaN` —
 * responsabilidad de quien llama comprobarlo antes de mandar el
 * formulario (`ProgramaForm.tsx` ya exige el campo).
 */
export function eurosToCents(input: string): number {
  const normalized = input.trim().replace(",", ".");
  if (normalized === "") return NaN;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return NaN;
  return Math.round(parsed * 100);
}
