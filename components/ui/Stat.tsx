export interface StatProps {
  label: string;
  value: number | string | null;
  suppressed?: boolean;
}

/**
 * Métrica suprimida por el umbral de agregación
 * (`settings.PANEL_MIN_GROUP_SIZE`, `docs/PANEL.md` §1.5): se pinta como
 * «<5», nunca como cero ni en blanco, para no sugerir que no hay datos.
 */
export function Stat({ label, value, suppressed = false }: StatProps) {
  const display = suppressed ? "<5" : (value ?? "—");
  return (
    <div>
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="text-2xl font-semibold text-text-base">{display}</dd>
    </div>
  );
}
