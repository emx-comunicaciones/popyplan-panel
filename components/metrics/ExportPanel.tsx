"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";
import type { MetricsGroupBy, MetricsScope } from "@/hooks/useMetrics";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

import { ExportButtons } from "./ExportButtons";
import { PeriodSelector } from "./PeriodSelector";

interface ExportPanelOwnProps {
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
   * Ámbitos entre los que puede elegir quien exporta. Con dos o más, el
   * panel pinta un `<select>` «Ámbito del informe» y la descarga usa el
   * elegido; con uno (o sin la prop) se comporta como siempre y usa
   * `scope`. Lo usa Informes del área de administración (spec §4.1):
   * la misma pantalla exporta el territorio o la red financiada, que son
   * dos rutas distintas del backend con el mismo formato de salida.
   */
  scopeChoices?: readonly MetricsScope[];
}

const SCOPE_LABEL_KEYS: Record<MetricsScope, string> = {
  entidad: "scopeEntidad",
  paraguas: "scopeRedFinanciada",
  plataforma: "scopePlataforma",
  territorio: "scopeTerritorio",
};

/**
 * Periodo controlado por el dashboard que envuelve este panel: con él, el
 * selector de aquí y el de arriba son el mismo periodo (antes cada uno
 * llevaba el suyo y se exportaba un rango distinto del que se estaba
 * mirando). Los tres van juntos por tipo: un `period` sin
 * `onPeriodChange` dejaba el selector sin poder cambiar nada, y era un
 * error que solo se veía al usarlo.
 */
interface ControlledPeriodProps {
  period: Period;
  preset: PeriodPreset;
  onPeriodChange: (period: Period, preset: PeriodPreset) => void;
}

/**
 * Sin periodo del dashboard el panel conserva su propio estado, que es
 * como lo usan las páginas de Informes, donde va suelto. Los tres campos
 * se declaran como `undefined` (no ausentes) para que la unión discrimine.
 */
interface UncontrolledPeriodProps {
  period?: undefined;
  preset?: undefined;
  onPeriodChange?: undefined;
}

export type ExportPanelProps = ExportPanelOwnProps &
  (ControlledPeriodProps | UncontrolledPeriodProps);

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
  scopeChoices,
  period,
  preset,
  onPeriodChange,
}: ExportPanelProps) {
  const t = useTranslations("metrics.export");
  const [ownPreset, setOwnPreset] = useState<PeriodPreset>("mes");
  const [ownPeriod, setOwnPeriod] = useState<Period>(() => presetPeriod("mes"));
  const [exportGroupBy, setExportGroupBy] = useState<ExportGroupByChoice>("habitual");
  const [chosenScope, setChosenScope] = useState<MetricsScope>(scope);
  const selectId = useId();
  const scopeSelectId = useId();

  const showScopeSelect = (scopeChoices?.length ?? 0) > 1;
  const effectiveScope = showScopeSelect ? chosenScope : scope;

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
    <Card title={t("title")}>
      <p className="mb-4 text-sm text-text-secondary">{t("noNamesNotice")}</p>
      <PeriodSelector value={effectivePeriod} preset={effectivePreset} onChange={handlePeriodChange} />
      {showScopeSelect ? (
        <div className="mt-4">
          <label htmlFor={scopeSelectId} className="mb-1 block text-sm font-medium text-text-form">
            {t("scopeLabel")}
          </label>
          <select
            id={scopeSelectId}
            value={chosenScope}
            onChange={(event) => setChosenScope(event.target.value as MetricsScope)}
            className="rounded-md border border-border px-2 py-1 text-sm text-text-base focus-visible:outline-primary-700"
          >
            {(scopeChoices ?? []).map((choice) => (
              <option key={choice} value={choice}>
                {t(SCOPE_LABEL_KEYS[choice])}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="mt-4">
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-text-form">
          {t("groupByLabel")}
        </label>
        <select
          id={selectId}
          value={exportGroupBy}
          onChange={(event) => setExportGroupBy(event.target.value as ExportGroupByChoice)}
          className="rounded-md border border-border px-2 py-1 text-sm text-text-base focus-visible:outline-primary-700"
        >
          <option value="habitual">{t("groupByRegular")}</option>
          <option value="year">{t("groupByYear")}</option>
        </select>
      </div>
      <div className="mt-4">
        <ExportButtons
          params={{ scope: effectiveScope, orgId, period: effectivePeriod, groupBy: effectiveGroupBy }}
        />
      </div>
    </Card>
  );
}
