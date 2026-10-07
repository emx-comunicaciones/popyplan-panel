"use client";

/**
 * Paradas de un viaje en el formulario de actividad (`ActividadForm.tsx`).
 * Lista ordenada: nombre obligatorio y dirección opcional en texto. El panel
 * no tiene buscador de direcciones, así que las coordenadas no se editan:
 * las que puso la app se conservan (`lib/events/activityExtras.ts::StopDraft`).
 */
import { useId, useRef } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { MAX_STOPS, moveStop, type StopDraft } from "@/lib/events/activityExtras";

export interface ActividadParadasProps {
  stops: StopDraft[];
  onChange: (stops: StopDraft[]) => void;
}

export function ActividadParadas({ stops, onChange }: ActividadParadasProps) {
  const t = useTranslations("entidad.actividadForm");
  const baseId = useId();
  const nextKey = useRef(0);

  function update(index: number, patch: Partial<StopDraft>) {
    onChange(stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)));
  }

  function add() {
    nextKey.current += 1;
    onChange([
      ...stops,
      { key: `new-${nextKey.current}`, name: "", address: "", latitude: null, longitude: null },
    ]);
  }

  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium text-text-form">{t("stopsTitle")}</legend>
      <p className="mb-2 text-xs text-text-secondary">{t("stopsHelp")}</p>
      {stops.length === 0 ? <p className="mb-2 text-sm text-text-secondary">{t("stopsEmpty")}</p> : null}
      <ol className="flex flex-col gap-2">
        {stops.map((stop, index) => {
          const number = index + 1;
          const nameId = `${baseId}-name-${stop.key}`;
          const addressId = `${baseId}-address-${stop.key}`;
          return (
            <li key={stop.key} className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1">
                <label htmlFor={nameId} className="mb-1 block text-xs text-text-form">
                  {t("stopNameLabel", { number })}
                </label>
                <input
                  id={nameId}
                  type="text"
                  value={stop.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                  className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
                />
              </div>
              <div className="min-w-40 flex-1">
                <label htmlFor={addressId} className="mb-1 block text-xs text-text-form">
                  {t("stopAddressLabel", { number })}
                </label>
                <input
                  id={addressId}
                  type="text"
                  value={stop.address}
                  onChange={(event) => update(index, { address: event.target.value })}
                  className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
                />
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={t("stopUpA11y", { number })}
                  disabled={index === 0}
                  onClick={() => onChange(moveStop(stops, index, -1))}
                >
                  {t("stopUp")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={t("stopDownA11y", { number })}
                  disabled={index === stops.length - 1}
                  onClick={() => onChange(moveStop(stops, index, 1))}
                >
                  {t("stopDown")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={t("stopRemoveA11y", { number })}
                  onClick={() => onChange(stops.filter((_, i) => i !== index))}
                >
                  {t("stopRemove")}
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={add} disabled={stops.length >= MAX_STOPS}>
          {t("stopsAdd")}
        </Button>
        {stops.length >= MAX_STOPS ? (
          <span className="text-xs text-text-secondary">{t("stopsMaxReached", { max: MAX_STOPS })}</span>
        ) : null}
      </div>
    </fieldset>
  );
}
