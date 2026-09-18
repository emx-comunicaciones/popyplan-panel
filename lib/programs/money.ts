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
 * `eurosToCents("19,99") → 1999`; acepta coma o punto decimal. Una
 * cadena vacía, no numérica o negativa da `NaN` — responsabilidad de
 * quien llama comprobarlo antes de mandar el formulario
 * (`ProgramaForm.tsx`/`ContratoForm.tsx`/`FacturaForm.tsx` ya exigen el
 * campo y bloquean el envío con `NaN`).
 *
 * Los formularios del panel usan `<input type="number">`, cuyo `value`
 * siempre llega normalizado (punto decimal, sin separador de millares ni
 * espacios), así que aceptar el formato es-ES pegado desde fuera
 * («1.234,56», «1 234,56») es **defensivo**: cubre un `value` que venga
 * de otro origen sin cambiar nada de lo que ya funcionaba. Solo se
 * quitan los puntos cuando hay una coma decimal: sin ella, «1.234» es lo
 * que manda un `type="number"` para 1,234 € y se sigue leyendo así.
 */
export function eurosToCents(input: string): number {
  const withoutSpaces = input.trim().replace(/[\s  ]/g, "");
  if (withoutSpaces === "") return NaN;
  const withoutGrouping = withoutSpaces.includes(",")
    ? withoutSpaces.replace(/\./g, "")
    : withoutSpaces;
  const parsed = Number(withoutGrouping.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return Math.round(parsed * 100);
}
