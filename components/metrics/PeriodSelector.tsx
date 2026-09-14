"use client";

import { useId, useState } from "react";

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
}

type FixedPreset = Exclude<PeriodPreset, "personalizado">;

const PRESET_LABELS: Record<FixedPreset, string> = {
  mes: "Este mes",
  trimestre: "Trimestre",
  anio: "Año",
  plurianual: "Plurianual",
};

const FIXED_PRESETS = Object.keys(PRESET_LABELS) as FixedPreset[];

const ERROR_MESSAGES: Record<PeriodValidationError, string> = {
  fecha_invalida: "Introduce fechas válidas.",
  rango_invertido: "La fecha de inicio debe ser anterior o igual a la de fin.",
  periodo_demasiado_largo: "El periodo no puede superar 4 años (1461 días).",
};

/** Selector de periodo: mes/trimestre/año (presets) o rango personalizado. */
export function PeriodSelector({ value, preset, onChange }: PeriodSelectorProps) {
  const [customSince, setCustomSince] = useState(value.since);
  const [customUntil, setCustomUntil] = useState(value.until);
  const [error, setError] = useState<PeriodValidationError | null>(null);
  const sinceId = useId();
  const untilId = useId();

  function selectPreset(next: FixedPreset) {
    setError(null);
    const period = presetPeriod(next);
    setCustomSince(period.since);
    setCustomUntil(period.until);
    onChange(period, next);
  }

  function applyCustom() {
    const result = customPeriod(customSince, customUntil);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    onChange(result.period, "personalizado");
  }

  return (
    <fieldset className="flex flex-wrap items-end gap-3">
      <legend className="mb-1 w-full text-sm font-medium text-text-form">Periodo</legend>
      {FIXED_PRESETS.map((key) => (
        <Button
          key={key}
          type="button"
          variant={preset === key ? "primary" : "secondary"}
          onClick={() => selectPreset(key)}
        >
          {PRESET_LABELS[key]}
        </Button>
      ))}
      <div className="flex items-end gap-2">
        <div>
          <label htmlFor={sinceId} className="mb-1 block text-xs font-medium text-text-form">
            Desde
          </label>
          <input
            id={sinceId}
            type="date"
            value={customSince}
            onChange={(event) => setCustomSince(event.target.value)}
            className="rounded-md border border-border px-2 py-1 text-sm text-text-base focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor={untilId} className="mb-1 block text-xs font-medium text-text-form">
            Hasta
          </label>
          <input
            id={untilId}
            type="date"
            value={customUntil}
            onChange={(event) => setCustomUntil(event.target.value)}
            className="rounded-md border border-border px-2 py-1 text-sm text-text-base focus-visible:outline-primary-700"
          />
        </div>
        <Button
          type="button"
          variant={preset === "personalizado" ? "primary" : "secondary"}
          onClick={applyCustom}
        >
          Personalizado
        </Button>
      </div>
      {error ? (
        <p role="alert" className="w-full text-sm text-error">
          {ERROR_MESSAGES[error]}
        </p>
      ) : null}
    </fieldset>
  );
}
