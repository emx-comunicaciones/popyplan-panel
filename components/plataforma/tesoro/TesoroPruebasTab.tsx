"use client";

/**
 * Pestaña «Pruebas» de la ficha de un juego: las pistas en orden
 * (`GET .../steps/list/`), alta/edición en un `Dialog` y borrado con
 * `ConfirmDialog` (el backend reordena las posteriores para no dejar
 * huecos).
 *
 * El tipo de prueba decide qué pide el formulario: `answer` exige la
 * respuesta correcta (solo de escritura: al editar no se puede enseñar,
 * vacío = conservar la guardada); `location` exige latitud/longitud y un
 * radio en metros; `photo`/`social` no piden nada más — se revisan a mano
 * en «Validaciones». Las coordenadas son dos campos numéricos sencillos:
 * un buscador de municipio no sirve aquí, la prueba es un punto exacto.
 *
 * `order` es único por juego pero el backend no lo valida con un 400 (el
 * serializer no incluye `game`, así que un repetido da un 500); el panel
 * propone el siguiente libre y rechaza uno repetido antes de mandar nada
 * (`lib/treasureHunt/validation.ts::validateStep`).
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useTreasureSteps } from "@/hooks/useTreasureHunt";
import { useDeleteTreasureStep, useSaveTreasureStep } from "@/hooks/useTreasureHuntMutations";
import type { TreasureChallengeType, TreasureStep, TreasureStepWriteInput } from "@/lib/api/types";
import { formatCoordinateForApi } from "@/lib/events/coords";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { nextStepOrder, parseCoordinate, validateStep, type StepErrorKind } from "@/lib/treasureHunt/validation";

import {
  CHALLENGE_TYPES,
  CHALLENGE_TYPE_KEYS,
  FIELD_CLASS,
  LABEL_CLASS,
  TREASURE_ERROR_FALLBACK,
  TREASURE_ERROR_KEYS,
} from "./shared";

const STEP_ERROR_KEYS: Record<StepErrorKind, string> = {
  orden_invalido: "plataforma.tesoroFicha.pruebas.errors.orderInvalid",
  orden_repetido: "plataforma.tesoroFicha.pruebas.errors.orderTaken",
  sin_pista: "plataforma.tesoroFicha.pruebas.errors.noClue",
  sin_respuesta: "plataforma.tesoroFicha.pruebas.errors.noAnswer",
  sin_coordenadas: "plataforma.tesoroFicha.pruebas.errors.noCoordinates",
  coordenadas_invalidas: "plataforma.tesoroFicha.pruebas.errors.badCoordinates",
};

interface StepFormProps {
  gameId: string;
  steps: TreasureStep[];
  editing: TreasureStep | null;
  onDone: () => void;
}

function StepForm({ gameId, steps, editing, onDone }: StepFormProps) {
  const t = useTranslations();
  const save = useSaveTreasureStep(gameId);
  const [order, setOrder] = useState(String(editing?.order ?? nextStepOrder(steps)));
  const [clue, setClue] = useState(editing?.clue ?? "");
  const [hint, setHint] = useState(editing?.hint ?? "");
  const [challengeType, setChallengeType] = useState<TreasureChallengeType>(editing?.challenge_type ?? "answer");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [latitude, setLatitude] = useState(editing?.latitude != null ? String(editing.latitude) : "");
  const [longitude, setLongitude] = useState(editing?.longitude != null ? String(editing.longitude) : "");
  const [radius, setRadius] = useState(String(editing?.location_radius_meters ?? 100));
  const [points, setPoints] = useState(String(editing?.points_base ?? 10));
  const [bonus, setBonus] = useState(String(editing?.time_bonus_seconds ?? 300));
  const [touched, setTouched] = useState(false);

  const hasStoredAnswer = editing?.challenge_type === "answer";
  const problem = validateStep(
    { order: Number(order), clue, challengeType, correctAnswer, latitude, longitude },
    steps,
    editing?.id,
    hasStoredAnswer,
  );
  const numbersValid = [radius, points, bonus].every((value) => value.trim() !== "" && Number.isInteger(Number(value)) && Number(value) >= 0);

  function close() {
    save.reset();
    onDone();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (problem || !numbersValid || save.isPending) return;
    const input: TreasureStepWriteInput = {
      order: Number(order),
      clue: clue.trim(),
      hint: hint.trim(),
      challenge_type: challengeType,
      points_base: Number(points),
      time_bonus_seconds: Number(bonus),
    };
    if (challengeType === "answer" && correctAnswer.trim()) input.correct_answer = correctAnswer.trim();
    if (challengeType === "location") {
      input.latitude = formatCoordinateForApi(parseCoordinate(latitude) as number);
      input.longitude = formatCoordinateForApi(parseCoordinate(longitude) as number);
      input.location_radius_meters = Number(radius);
    }
    save.mutate({ stepId: editing?.id, input }, { onSuccess: onDone });
  }

  const showProblem = touched && problem;

  return (
    <Dialog
      open
      titleId="tesoro-prueba-title"
      title={editing ? t("plataforma.tesoroFicha.pruebas.editTitle") : t("plataforma.tesoroFicha.pruebas.newTitle")}
      onClose={close}
      pending={save.isPending}
      widthClassName="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="w-28">
            <label htmlFor="tesoro-prueba-order" className={LABEL_CLASS}>
              {t("plataforma.tesoroFicha.pruebas.order")}
            </label>
            <input id="tesoro-prueba-order" type="number" min={1} value={order} onChange={(e) => setOrder(e.target.value)} className={FIELD_CLASS} />
          </div>
          <div className="min-w-48 flex-1">
            <label htmlFor="tesoro-prueba-type" className={LABEL_CLASS}>
              {t("plataforma.tesoroFicha.pruebas.type")}
            </label>
            <select
              id="tesoro-prueba-type"
              value={challengeType}
              onChange={(e) => setChallengeType(e.target.value as TreasureChallengeType)}
              className={FIELD_CLASS}
            >
              {CHALLENGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(CHALLENGE_TYPE_KEYS[type])}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="tesoro-prueba-clue" className={LABEL_CLASS}>
            {t("plataforma.tesoroFicha.pruebas.clue")}
          </label>
          <textarea id="tesoro-prueba-clue" rows={3} value={clue} onChange={(e) => setClue(e.target.value)} className={FIELD_CLASS} />
        </div>
        <div>
          <label htmlFor="tesoro-prueba-hint" className={LABEL_CLASS}>
            {t("plataforma.tesoroFicha.pruebas.hint")}
          </label>
          <textarea
            id="tesoro-prueba-hint"
            rows={2}
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            aria-describedby="tesoro-prueba-hint-help"
            className={FIELD_CLASS}
          />
          <p id="tesoro-prueba-hint-help" className="mt-1 text-xs text-text-secondary">
            {t("plataforma.tesoroFicha.pruebas.hintHelp")}
          </p>
        </div>

        {challengeType === "answer" ? (
          <div>
            <label htmlFor="tesoro-prueba-answer" className={LABEL_CLASS}>
              {t("plataforma.tesoroFicha.pruebas.correctAnswer")}
            </label>
            <input
              id="tesoro-prueba-answer"
              type="text"
              maxLength={500}
              autoComplete="off"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              aria-describedby="tesoro-prueba-answer-help"
              className={FIELD_CLASS}
            />
            <p id="tesoro-prueba-answer-help" className="mt-1 text-xs text-text-secondary">
              {hasStoredAnswer
                ? t("plataforma.tesoroFicha.pruebas.correctAnswerKeep")
                : t("plataforma.tesoroFicha.pruebas.correctAnswerHelp")}
            </p>
          </div>
        ) : null}

        {challengeType === "location" ? (
          <div className="flex flex-wrap gap-3">
            <div className="min-w-32 flex-1">
              <label htmlFor="tesoro-prueba-lat" className={LABEL_CLASS}>
                {t("plataforma.tesoroFicha.pruebas.latitude")}
              </label>
              <input
                id="tesoro-prueba-lat"
                type="text"
                inputMode="decimal"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div className="min-w-32 flex-1">
              <label htmlFor="tesoro-prueba-lng" className={LABEL_CLASS}>
                {t("plataforma.tesoroFicha.pruebas.longitude")}
              </label>
              <input
                id="tesoro-prueba-lng"
                type="text"
                inputMode="decimal"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div className="w-36">
              <label htmlFor="tesoro-prueba-radius" className={LABEL_CLASS}>
                {t("plataforma.tesoroFicha.pruebas.radius")}
              </label>
              <input
                id="tesoro-prueba-radius"
                type="number"
                min={0}
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <p className="w-full text-xs text-text-secondary">{t("plataforma.tesoroFicha.pruebas.locationHelp")}</p>
          </div>
        ) : null}

        {challengeType === "photo" || challengeType === "social" ? (
          <p className="text-xs text-text-secondary">{t("plataforma.tesoroFicha.pruebas.manualReviewHelp")}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <div className="min-w-32 flex-1">
            <label htmlFor="tesoro-prueba-points" className={LABEL_CLASS}>
              {t("plataforma.tesoroFicha.pruebas.points")}
            </label>
            <input id="tesoro-prueba-points" type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} className={FIELD_CLASS} />
          </div>
          <div className="min-w-32 flex-1">
            <label htmlFor="tesoro-prueba-bonus" className={LABEL_CLASS}>
              {t("plataforma.tesoroFicha.pruebas.bonus")}
            </label>
            <input
              id="tesoro-prueba-bonus"
              type="number"
              min={0}
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              aria-describedby="tesoro-prueba-bonus-help"
              className={FIELD_CLASS}
            />
            <p id="tesoro-prueba-bonus-help" className="mt-1 text-xs text-text-secondary">
              {t("plataforma.tesoroFicha.pruebas.bonusHelp")}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending || (touched && (!!problem || !numbersValid))}>
            {editing ? t("common.save") : t("plataforma.tesoroFicha.pruebas.createAction")}
          </Button>
          <Button type="button" variant="secondary" onClick={close} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
        </div>
        {showProblem ? (
          <p role="alert" className="text-sm text-error">
            {t(STEP_ERROR_KEYS[problem])}
          </p>
        ) : touched && !numbersValid ? (
          <p role="alert" className="text-sm text-error">
            {t("plataforma.tesoroFicha.pruebas.errors.badNumbers")}
          </p>
        ) : null}
        {save.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(save.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

export function TesoroPruebasTab({ gameId }: { gameId: string }) {
  const t = useTranslations();
  const steps = useTreasureSteps(gameId);
  const remove = useDeleteTreasureStep(gameId);
  const [editing, setEditing] = useState<TreasureStep | "new" | null>(null);
  const [deleting, setDeleting] = useState<TreasureStep | null>(null);

  function closeDelete() {
    remove.reset();
    setDeleting(null);
  }

  if (steps.isError) {
    return (
      <ErrorState
        title={t("plataforma.tesoroFicha.pruebas.loadError")}
        description={errorKindText(steps.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
      />
    );
  }
  if (!steps.data) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }

  const rows = [...steps.data].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button type="button" onClick={() => setEditing("new")}>
          {t("plataforma.tesoroFicha.pruebas.newTitle")}
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t("plataforma.tesoroFicha.pruebas.empty")} description={t("plataforma.tesoroFicha.pruebas.emptyHint")} />
      ) : (
        <Table
          caption={t("plataforma.tesoroFicha.pruebas.tableCaption")}
          rows={rows}
          getRowKey={(step) => step.id}
          columns={[
            { key: "order", header: t("plataforma.tesoroFicha.pruebas.order"), render: (step) => String(step.order) },
            { key: "clue", header: t("plataforma.tesoroFicha.pruebas.clue"), render: (step) => step.clue },
            {
              key: "type",
              header: t("plataforma.tesoroFicha.pruebas.type"),
              render: (step) => (CHALLENGE_TYPE_KEYS[step.challenge_type] ? t(CHALLENGE_TYPE_KEYS[step.challenge_type]) : step.challenge_type),
            },
            {
              key: "where",
              header: t("plataforma.tesoroFicha.pruebas.where"),
              render: (step) =>
                step.latitude != null && step.longitude != null
                  ? t("plataforma.tesoroFicha.pruebas.whereValue", {
                      lat: step.latitude.toFixed(5),
                      lng: step.longitude.toFixed(5),
                      radius: step.location_radius_meters ?? 100,
                    })
                  : "—",
            },
            { key: "points", header: t("plataforma.tesoroFicha.pruebas.points"), render: (step) => String(step.points_base ?? 10) },
            {
              key: "actions",
              header: <span className="sr-only">{t("common.actions")}</span>,
              render: (step) => (
                <span className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditing(step)}>
                    {t("plataforma.tesoroFicha.pruebas.edit")}
                  </Button>
                  <Button type="button" variant="danger" onClick={() => setDeleting(step)}>
                    {t("plataforma.tesoroFicha.pruebas.delete")}
                  </Button>
                </span>
              ),
            },
          ]}
        />
      )}

      {editing ? (
        <StepForm
          key={editing === "new" ? "new" : editing.id}
          gameId={gameId}
          steps={rows}
          editing={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title={t("plataforma.tesoroFicha.pruebas.deleteTitle")}
        description={
          <>
            <span>{t("plataforma.tesoroFicha.pruebas.deleteDescription", { order: deleting?.order ?? 0 })}</span>
            {remove.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(remove.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.tesoroFicha.pruebas.delete")}
        pending={remove.isPending}
        onCancel={closeDelete}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
