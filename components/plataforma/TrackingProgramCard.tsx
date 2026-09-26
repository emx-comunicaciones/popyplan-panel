"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSetTrackingProgram } from "@/hooks/useSetTrackingProgram";
import { errorKindText } from "@/lib/i18n/errorKindText";

const SET_TRACKING_PROGRAM_ERROR_KEYS = {
  invalido: "errors.setTrackingProgram.invalido",
  sin_permiso: "errors.setTrackingProgram.sinPermiso",
  desconocido: "errors.setTrackingProgram.desconocido",
} as const;

export interface TrackingProgramCardProps {
  orgId: number | string;
  enabled: boolean;
}

/**
 * Interruptor «Programa de seguimiento» de la ficha de entidad
 * (`docs/PANEL.md` §18.2). Solo lo monta `EntidadDetail` para
 * `superadmin`; el resto de roles de plataforma ve el estado en solo
 * lectura dentro de la `<dl>` de Datos. Encender y apagar piden
 * confirmación: encender habilita el tratamiento de datos de salud, y
 * apagar deja en suspenso las inscripciones. El error del backend (p. ej.
 * «solo asociaciones u ONG verificadas») se pinta literal dentro del
 * diálogo, que solo se cierra si el cambio sale bien.
 */
export function TrackingProgramCard({ orgId, enabled }: TrackingProgramCardProps) {
  const t = useTranslations("plataforma.entidadFicha");
  const tAll = useTranslations();
  const setTracking = useSetTrackingProgram(orgId);
  const [confirming, setConfirming] = useState(false);
  const next = !enabled;

  return (
    <Card title={t("trackingLabel")}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="tracking-program-switch-label"
          aria-describedby="tracking-program-switch-hint"
          onClick={() => {
            setTracking.reset();
            setConfirming(true);
          }}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-border transition-colors ${
            enabled ? "bg-primary-700" : "bg-border-light"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-6 w-6 rounded-full bg-white border border-border transition-transform ${
              enabled ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
        <span id="tracking-program-switch-label" className="text-sm font-medium text-text-base">
          {t("trackingSwitchLabel")}
        </span>
        <span className="text-sm text-text-secondary">{enabled ? t("trackingOn") : t("trackingOff")}</span>
      </div>
      <p id="tracking-program-switch-hint" className="mt-2 text-xs text-text-secondary">
        {t("trackingHint")}
      </p>
      <ConfirmDialog
        open={confirming}
        title={next ? t("trackingEnableConfirmTitle") : t("trackingDisableConfirmTitle")}
        description={
          <div className="flex flex-col gap-2">
            <p>{next ? t("trackingEnableConfirmDescription") : t("trackingDisableConfirmDescription")}</p>
            {setTracking.isError ? (
              <p role="alert" className="text-error">
                {errorKindText(setTracking.error, SET_TRACKING_PROGRAM_ERROR_KEYS, tAll, "errors.setTrackingProgram.desconocido")}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={next ? t("trackingEnableAction") : t("trackingDisableAction")}
        pending={setTracking.isPending}
        onConfirm={() => setTracking.mutate(next, { onSuccess: () => setConfirming(false) })}
        onCancel={() => {
          setTracking.reset();
          setConfirming(false);
        }}
      />
    </Card>
  );
}
