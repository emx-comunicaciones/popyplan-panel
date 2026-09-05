"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import type { MetricsGroupBy, MetricsScope } from "@/hooks/useMetrics";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

import { ExportButtons } from "./ExportButtons";
import { PeriodSelector } from "./PeriodSelector";

export interface ExportPanelProps {
  scope: MetricsScope;
  orgId?: number | string;
  groupBy?: MetricsGroupBy;
}

/**
 * Panel de exportación: periodo + botones CSV/PDF + aviso «sin nombres»
 * (invariante 9: el panel nunca muestra documentos ni números de
 * identidad; los informes agregados tampoco llevan nombres de personas).
 */
export function ExportPanel({ scope, orgId, groupBy }: ExportPanelProps) {
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [period, setPeriod] = useState<Period>(() => presetPeriod("mes"));

  function handlePeriodChange(next: Period, nextPreset: PeriodPreset) {
    setPeriod(next);
    setPreset(nextPreset);
  }

  return (
    <Card title="Exportar informe">
      <p className="mb-4 text-sm text-text-secondary">
        Los informes no contienen nombres de personas.
      </p>
      <PeriodSelector value={period} preset={preset} onChange={handlePeriodChange} />
      <div className="mt-4">
        <ExportButtons params={{ scope, orgId, period, groupBy }} />
      </div>
    </Card>
  );
}
