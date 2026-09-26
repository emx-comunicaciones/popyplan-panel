"use client";

/**
 * Pestaña «Validaciones» de la ficha de un juego: los envíos de las
 * pruebas de foto y sociales que esperan revisión a mano
 * (`GET .../completions/`, solo `is_valid=false` de tipo `photo`/`social`).
 *
 * - **Aprobar** (`{is_valid: true, points_override?}`) da los puntos y hace
 *   avanzar al equipo; los puntos se pueden sobrescribir (vacío = los
 *   puntos base de la prueba).
 * - **Rechazar** (`{is_valid: false}`) **borra** el envío para que el
 *   equipo lo reintente — por eso pide confirmación.
 *
 * La foto se pinta con `next/image` solo si su host está permitido
 * (`isAllowedImageSrc`, el mismo guard que las cabeceras: si no, `next/image`
 * lanzaría en render); si no lo está, un enlace para abrirla aparte.
 */
import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useTreasureCompletions } from "@/hooks/useTreasureHunt";
import { useValidateTreasureCompletion } from "@/hooks/useTreasureHuntMutations";
import type { TreasureChallengeType, TreasureCompletion } from "@/lib/api/types";
import { isAllowedImageSrc } from "@/lib/config/imagePatterns";
import { errorKindText } from "@/lib/i18n/errorKindText";

import {
  CHALLENGE_TYPE_KEYS,
  FIELD_CLASS,
  LABEL_CLASS,
  TREASURE_ERROR_FALLBACK,
  TREASURE_ERROR_KEYS,
  formatDateTime,
} from "./shared";

function CompletionCard({ gameId, completion }: { gameId: string; completion: TreasureCompletion }) {
  const t = useTranslations();
  const validate = useValidateTreasureCompletion(gameId);
  const [points, setPoints] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const typeKey = CHALLENGE_TYPE_KEYS[completion.challenge_type as TreasureChallengeType];
  const pointsNumber = points.trim() ? Number(points) : undefined;
  const pointsValid = pointsNumber === undefined || (Number.isInteger(pointsNumber) && pointsNumber >= 0);
  const pointsId = `tesoro-validacion-points-${completion.id}`;

  function closeReject() {
    validate.reset();
    setRejecting(false);
  }

  return (
    <Card title={t("plataforma.tesoroFicha.validaciones.cardTitle", { order: completion.step_order, team: completion.team_name })}>
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-text-base">{completion.step_clue}</p>
        <p className="text-xs text-text-secondary">
          {t("plataforma.tesoroFicha.validaciones.meta", {
            type: typeKey ? t(typeKey) : completion.challenge_type,
            date: formatDateTime(completion.completed_at),
          })}
        </p>
        {completion.answer ? (
          <p>
            <span className="font-medium text-text-form">{t("plataforma.tesoroFicha.validaciones.answerLabel")}</span>{" "}
            {completion.answer}
          </p>
        ) : null}
        {completion.photo ? (
          isAllowedImageSrc(completion.photo) ? (
            <Image
              src={completion.photo}
              alt={t("plataforma.tesoroFicha.validaciones.photoAlt", { team: completion.team_name })}
              width={320}
              height={240}
              className="h-auto max-w-xs rounded-md border border-border object-contain"
            />
          ) : (
            <a href={completion.photo} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">
              {t("plataforma.tesoroFicha.validaciones.openPhoto")}
            </a>
          )
        ) : (
          <p className="text-xs text-text-secondary">{t("plataforma.tesoroFicha.validaciones.noPhoto")}</p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <label htmlFor={pointsId} className={LABEL_CLASS}>
              {t("plataforma.tesoroFicha.validaciones.pointsOverride")}
            </label>
            <input
              id={pointsId}
              type="number"
              min={0}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>
          <Button
            type="button"
            disabled={!pointsValid || validate.isPending}
            onClick={() => {
              validate.reset();
              validate.mutate({
                completionId: completion.id,
                input: pointsNumber === undefined ? { is_valid: true } : { is_valid: true, points_override: pointsNumber },
              });
            }}
          >
            {t("plataforma.tesoroFicha.validaciones.approve")}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={validate.isPending}
            onClick={() => {
              validate.reset();
              setRejecting(true);
            }}
          >
            {t("plataforma.tesoroFicha.validaciones.reject")}
          </Button>
        </div>
        <p className="text-xs text-text-secondary">{t("plataforma.tesoroFicha.validaciones.pointsHelp")}</p>
        {validate.isError && !rejecting ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(validate.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={rejecting}
        title={t("plataforma.tesoroFicha.validaciones.rejectTitle")}
        description={
          <>
            <span>{t("plataforma.tesoroFicha.validaciones.rejectDescription")}</span>
            {validate.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(validate.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.tesoroFicha.validaciones.reject")}
        pending={validate.isPending}
        onCancel={closeReject}
        onConfirm={() =>
          validate.mutate(
            { completionId: completion.id, input: { is_valid: false } },
            { onSuccess: () => setRejecting(false) },
          )
        }
      />
    </Card>
  );
}

export function TesoroValidacionesTab({ gameId }: { gameId: string }) {
  const t = useTranslations();
  const completions = useTreasureCompletions(gameId);

  if (completions.isError) {
    return (
      <ErrorState
        title={t("plataforma.tesoroFicha.validaciones.loadError")}
        description={errorKindText(completions.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
      />
    );
  }
  if (!completions.data) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }
  if (completions.data.length === 0) {
    return (
      <EmptyState
        title={t("plataforma.tesoroFicha.validaciones.empty")}
        description={t("plataforma.tesoroFicha.validaciones.emptyHint")}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {completions.data.map((completion) => (
        <CompletionCard key={completion.id} gameId={gameId} completion={completion} />
      ))}
    </div>
  );
}
