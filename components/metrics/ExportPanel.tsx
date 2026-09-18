"use client";

import { useId, useState } from "react";

import { Card } from "@/components/ui/Card";
import type { MetricsGroupBy, MetricsScope } from "@/hooks/useMetrics";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

import { ExportButtons } from "./ExportButtons";
import { PeriodSelector } from "./PeriodSelector";

export interface ExportPanelProps {
  scope: MetricsScope;
  orgId?: number | string;
  /**
   * Desglose «habitual» del informe (`place`/`organization`…), normalmente
   * el mismo que ya tiene elegido el desglose de la tabla del dashboard
   * que envuelve a este panel (`PlataformaMetricsDashboard.tsx`); sin él,
   * el backend usa su propio valor por defecto (`place`, `docs/PANEL.md`
   * §2). Se ignora mientras el desglose del propio panel esté en «Por
   * año» (más abajo): los dos son mutuamente excluyentes, nunca se piden
   * a la vez (`docs/PANEL.md` §11.4).
   */
  groupBy?: MetricsGroupBy;
  /**
   * Periodo controlado por el dashboard que envuelve este panel: con él,
   * el selector de aquí y el de arriba son el mismo periodo (antes cada
   * uno llevaba el suyo y se exportaba un rango distinto del que se
   * estaba mirando). Sin él, el panel conserva su propio estado, que es
   * como lo usan las páginas de Informes, donde va suelto.
   */
  period?: Period;
  preset?: PeriodPreset;
  /** Obligatorio junto a `period`: sin él el selector no podría cambiar nada. */
  onPeriodChange?: (period: Period, preset: PeriodPreset) => void;
}

type ExportGroupByChoice = "habitual" | "year";

/**
 * Panel de exportación: periodo + desglose + botones CSV/PDF + aviso «sin
 * nombres» (invariante 9: el panel nunca muestra documentos ni números de
 * identidad; los informes agregados tampoco llevan nombres de personas).
 *
 * **Memoria plurianual (`group_by=year`, tarea B2, `docs/PANEL.md` §11.4)**:
 * pedir `?group_by=year` deja vacía la sección «Por municipio» del informe
 * y renombra la serie temporal de «Por mes» a «Por año» — el propio
 * backend decide eso, este panel solo añade la opción al selector.
 */
export function ExportPanel({
  scope,
  orgId,
  groupBy,
  period,
  preset,
  onPeriodChange,
}: ExportPanelProps) {
  const [ownPreset, setOwnPreset] = useState<PeriodPreset>("mes");
  const [ownPeriod, setOwnPeriod] = useState<Period>(() => presetPeriod("mes"));
  const [exportGroupBy, setExportGroupBy] = useState<ExportGroupByChoice>("habitual");
  const selectId = useId();

  const controlled = period !== undefined;
  const effectivePeriod = period ?? ownPeriod;
  const effectivePreset = preset ?? ownPreset;

  function handlePeriodChange(next: Period, nextPreset: PeriodPreset) {
    if (controlled) {
      onPeriodChange?.(next, nextPreset);
      return;
    }
    setOwnPeriod(next);
    setOwnPreset(nextPreset);
  }

  const effectiveGroupBy: MetricsGroupBy | undefined =
    exportGroupBy === "year" ? "year" : groupBy;

  return (
    <Card title="Exportar informe">
      <p className="mb-4 text-sm text-text-secondary">
        Los informes no contienen nombres de personas.
      </p>
      <PeriodSelector value={effectivePeriod} preset={effectivePreset} onChange={handlePeriodChange} />
      <div className="mt-4">
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-text-form">
          Desglose del informe
        </label>
        <select
          id={selectId}
          value={exportGroupBy}
          onChange={(event) => setExportGroupBy(event.target.value as ExportGroupByChoice)}
          className="rounded-md border border-border px-2 py-1 text-sm text-text-base focus-visible:outline-primary-700"
        >
          <option value="habitual">Desglose habitual</option>
          <option value="year">Por año (memoria plurianual)</option>
        </select>
      </div>
      <div className="mt-4">
        <ExportButtons params={{ scope, orgId, period: effectivePeriod, groupBy: effectiveGroupBy }} />
      </div>
    </Card>
  );
}
