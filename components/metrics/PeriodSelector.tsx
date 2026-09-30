"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import {
  customPeriod,
  presetPeriod,
  type Period,
  type PeriodPreset,
  type PeriodValidationError,
} from "@/lib/metrics/period";

export interface PeriodSelectorProps {
  value: Period;
  preset: PeriodPreset;
  onChange: (period: Period, preset: PeriodPreset) => void;
  /**
   * `true` mientras las fechas escritas no son un periodo válido y, por
   * tanto, no son las que se están aplicando (quien exporta lo usa para no
   * descargar un periodo distinto del que se ve).
   */
  onPendingChange?: (pending: boolean) => void;
  /**
   * Botones de periodo fijo que se ofrecen, en este orden. Por defecto los
   * cuatro de siempre; «proximos» (hasta 30 días por delante de hoy) solo
   * lo pide la tabla de Actividades.
   */
  presets?: readonly FixedPreset[];
}

type FixedPreset = Exclude<PeriodPreset, "personalizado">;

const PRESET_LABEL_KEYS: Record<FixedPreset, string> = {
  proximos: "metrics.period.upcoming",
  mes: "metrics.period.thisMonth",
  trimestre: "metrics.period.quarter",
  anio: "metrics.period.year",
  plurianual: "metrics.period.multiYear",
};

const DEFAULT_PRESETS: readonly FixedPreset[] = ["mes", "trimestre", "anio", "plurianual"];

// La regla es sobre la **diferencia** entre las dos fechas, igual que en
// el backend (`panel/viewsets.py::_periodo`, `(until - since).days >
// 1461`): decir «no puede superar 1461 días» hacía leer como rechazado
// un periodo de 1462 días contando ambos extremos, que sí se acepta.
const ERROR_MESSAGE_KEYS: Record<PeriodValidationError, string> = {
  fecha_invalida: "metrics.period.errors.invalidDate",
  rango_invertido: "metrics.period.errors.reversedRange",
  periodo_demasiado_largo: "metrics.period.errors.tooLong",
};

/**
 * Selector de periodo: mes/trimestre/año (presets) o rango personalizado.
 *
 * Las fechas se aplican **al cambiarlas**, en cuanto forman un periodo
 * válido (informe de pruebas 2026-09-25): antes solo se aplicaban al
 * pulsar «Personalizado», y exportar sin pulsarlo descargaba el periodo
 * anterior con las fechas nuevas en pantalla. Mientras no son válidas, el
 * aviso sale al momento y `onPendingChange(true)` lo dice hacia fuera.
 */
export function PeriodSelector({
  value,
  preset,
  onChange,
  onPendingChange,
  presets = DEFAULT_PRESETS,
}: PeriodSelectorProps) {
  const t = useTranslations();
  const [customSince, setCustomSince] = useState(value.since);
  const [customUntil, setCustomUntil] = useState(value.until);
  const [error, setError] = useState<PeriodValidationError | null>(null);
  const sinceId = useId();
  const untilId = useId();

  // El periodo puede cambiar desde fuera (un dashboard que también lo
  // controla, `ExportPanel` con la prop `period`): sin esto, los dos
  // campos de fecha se quedaban con el rango con el que se montó el
  // selector y pulsar «Personalizado» devolvía el dashboard a ese rango
  // viejo. Las dependencias son las dos cadenas, no el objeto `value`:
  // un re-render del padre con las mismas fechas no vuelve a entrar y no
  // pisa lo que se esté tecleando.
  useEffect(() => {
    setCustomSince(value.since);
    setCustomUntil(value.until);
    setError(null);
    onPendingChange?.(false);
    // `onPendingChange` fuera a propósito: una función nueva del padre en
    // cada render no es un periodo nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.since, value.until]);

  function selectPreset(next: FixedPreset) {
    setError(null);
    onPendingChange?.(false);
    const period = presetPeriod(next);
    setCustomSince(period.since);
    setCustomUntil(period.until);
    onChange(period, next);
  }

  /**
   * Aplica `since`/`until` si son un periodo válido. Con `force` (el botón
   * «Personalizado») avisa aunque coincidan con el aplicado, para que el
   * preset pase a «personalizado».
   */
  function apply(since: string, until: string, force: boolean) {
    const result = customPeriod(since, until);
    if (result.error) {
      setError(result.error);
      onPendingChange?.(true);
      return;
    }
    setError(null);
    onPendingChange?.(false);
    if (force || since !== value.since || until !== value.until) {
      onChange(result.period, "personalizado");
    }
  }

  return (
    <fieldset className="flex flex-wrap items-end gap-3">
      <legend className="mb-1 w-full text-sm font-medium text-text-form">{t("metrics.period.legend")}</legend>
      {presets.map((key) => (
        <Button
          key={key}
          type="button"
          variant={preset === key ? "primary" : "secondary"}
          aria-pressed={preset === key}
          onClick={() => selectPreset(key)}
        >
          {t(PRESET_LABEL_KEYS[key])}
        </Button>
      ))}
      <div className="flex items-end gap-2">
        <div>
          <label htmlFor={sinceId} className="mb-1 block text-xs font-medium text-text-form">
            {t("metrics.period.from")}
          </label>
          <input
            id={sinceId}
            type="date"
            value={customSince}
            onChange={(event) => {
              setCustomSince(event.target.value);
              apply(event.target.value, customUntil, false);
            }}
            className="rounded-md border border-border px-2 py-1 text-sm text-text-base focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor={untilId} className="mb-1 block text-xs font-medium text-text-form">
            {t("metrics.period.to")}
          </label>
          <input
            id={untilId}
            type="date"
            value={customUntil}
            onChange={(event) => {
              setCustomUntil(event.target.value);
              apply(customSince, event.target.value, false);
            }}
            className="rounded-md border border-border px-2 py-1 text-sm text-text-base focus-visible:outline-primary-700"
          />
        </div>
        <Button
          type="button"
          variant={preset === "personalizado" ? "primary" : "secondary"}
          aria-pressed={preset === "personalizado"}
          onClick={() => apply(customSince, customUntil, true)}
        >
          {t("metrics.period.custom")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="w-full text-sm text-error">
          {t(ERROR_MESSAGE_KEYS[error])}
        </p>
      ) : null}
    </fieldset>
  );
}
