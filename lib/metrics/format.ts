/**
 * Formateo de las celdas de `docs/PANEL.md` §1.4/§1.5. Regla de
 * supresión (documentada también en `CLAUDE.md`): una celda que cuenta
 * personas distintas llega como `value: null, suppressed: true` cuando
 * el ámbito de agregación tiene menos de `PANEL_MIN_GROUP_SIZE` (5)
 * personas; el panel nunca la pinta como `0` ni en blanco — siempre
 * `<5`, para no sugerir que no hay datos. `formatCount`/`formatPct`
 * concentran esa regla en un solo sitio: los componentes de
 * `components/metrics/*` nunca deciden por sí mismos si algo está
 * suprimido, solo pintan la cadena que estas funciones ya han resuelto.
 */

const INTEGER_FORMATTER = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  useGrouping: "always",
});
const PERCENT_FORMATTER = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `formatCount(1284) → '1.284'`; `formatCount(null, true) → '<5'`. */
export function formatCount(value: number | null, suppressed = false): string {
  if (suppressed) return "<5";
  if (value === null) return "—";
  return INTEGER_FORMATTER.format(value);
}

/** `formatPct(0.75) → '75,0 %'`; `formatPct(null, true) → '<5'`. */
export function formatPct(value: number | null, suppressed = false): string {
  if (suppressed) return "<5";
  if (value === null) return "—";
  return `${PERCENT_FORMATTER.format(value * 100)} %`;
}
