"use client";

/**
 * Alta y edición de un juego de la búsqueda del tesoro (admin de
 * plataforma, bloque 2). Formulario presentacional: quien lo monta decide
 * qué mutación dispara (alta en el diálogo del listado, edición en la
 * pestaña Datos de la ficha) y le pasa su estado.
 *
 * - **Modo de juego**: esta versión de la app es solo individual, así que
 *   no se ofrece elegir; el alta manda `game_mode: "individual"` y la
 *   edición no lo toca (un juego heredado conserva el suyo).
 * - **Pago**: fuera de esta versión (`is_paid` solo admite `false`); el
 *   formulario ni lo pinta.
 * - **Hora de inicio**: el backend la exige futura solo si cambia. Al
 *   editar se compara por minuto (`sameMinute`, el `datetime-local` no
 *   rehidrata segundos) y solo viaja si cambió — el mismo fallo que ya
 *   costó un «Guardar» muerto en Actividades.
 * - **Imagen**: opcional; con ella el cuerpo va en multipart
 *   (`buildGamePayload`). Validada en el cliente (`validateGameImage`).
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import type { TreasureGameDetail, TreasureGameWriteInput } from "@/lib/api/types";
import { isoToLocalInput, localInputToIso } from "@/lib/events/datetimeLocal";
import { sameMinute } from "@/lib/events/validation";
import { GAME_IMAGE_MAX_MB, validateGameImage, type GameImageErrorKind } from "@/lib/treasureHunt/validation";

import { FIELD_CLASS, LABEL_CLASS } from "./shared";

const IMAGE_ERROR_KEYS: Record<GameImageErrorKind, string> = {
  tipo_no_permitido: "plataforma.tesoro.form.imageWrongType",
  demasiado_grande: "plataforma.tesoro.form.imageTooBig",
};

export interface TesoroJuegoFormProps {
  /** Sin juego, alta; con él, edición. */
  game?: TreasureGameDetail;
  pending: boolean;
  submitLabel: string;
  /** Error de la mutación ya traducido, pintado bajo los botones. */
  error?: ReactNode;
  onSubmit: (input: Partial<TreasureGameWriteInput>) => void;
  onCancel?: () => void;
  /** Prefijo de los `id` de los campos (dos formularios nunca conviven, pero así no dependen de ello). */
  idPrefix?: string;
}

export function TesoroJuegoForm({
  game,
  pending,
  submitLabel,
  error,
  onSubmit,
  onCancel,
  idPrefix = "tesoro-juego",
}: TesoroJuegoFormProps) {
  const t = useTranslations();
  const [name, setName] = useState(game?.name ?? "");
  const [description, setDescription] = useState(game?.description ?? "");
  const [city, setCity] = useState(game?.city ?? "");
  const [prize, setPrize] = useState(game?.prize_description ?? "");
  const [startLocal, setStartLocal] = useState(game ? isoToLocalInput(game.start_time) : "");
  const [duration, setDuration] = useState(String(game?.duration_minutes ?? 120));
  const [maxParticipants, setMaxParticipants] = useState(
    game?.max_participants ? String(game.max_participants) : "",
  );
  const [featured, setFeatured] = useState(game?.is_featured ?? false);
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState<GameImageErrorKind | null>(null);

  const startIso = localInputToIso(startLocal);
  const startChanged = !game || !sameMinute(startIso, game.start_time);
  const startInPast = startIso !== "" && startChanged && new Date(startIso).getTime() <= Date.now();
  const durationNumber = Number(duration);
  const durationValid = Number.isInteger(durationNumber) && durationNumber >= 1;
  const maxNumber = maxParticipants.trim() ? Number(maxParticipants) : null;
  const maxValid = maxNumber === null || (Number.isInteger(maxNumber) && maxNumber >= 1);

  const canSubmit =
    name.trim() !== "" &&
    description.trim() !== "" &&
    city.trim() !== "" &&
    prize.trim() !== "" &&
    startIso !== "" &&
    !startInPast &&
    durationValid &&
    maxValid &&
    imageError === null;

  function handleImage(file: File | null) {
    if (!file) {
      setImage(null);
      setImageError(null);
      return;
    }
    const problem = validateGameImage(file);
    setImageError(problem);
    setImage(problem ? null : file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending) return;
    const input: Partial<TreasureGameWriteInput> = {
      name: name.trim(),
      description: description.trim(),
      city: city.trim(),
      prize_description: prize.trim(),
      duration_minutes: durationNumber,
      max_participants: maxNumber,
      is_featured: featured,
    };
    if (startChanged) input.start_time = startIso;
    if (!game) input.game_mode = "individual";
    if (image) input.image = image;
    onSubmit(input);
  }

  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor={id("name")} className={LABEL_CLASS}>
          {t("plataforma.tesoro.form.name")}
        </label>
        <input id={id("name")} type="text" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} />
      </div>
      <div>
        <label htmlFor={id("description")} className={LABEL_CLASS}>
          {t("plataforma.tesoro.form.description")}
        </label>
        <textarea
          id={id("description")}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="min-w-40 flex-1">
          <label htmlFor={id("city")} className={LABEL_CLASS}>
            {t("plataforma.tesoro.form.city")}
          </label>
          <input id={id("city")} type="text" value={city} maxLength={100} onChange={(e) => setCity(e.target.value)} className={FIELD_CLASS} />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor={id("start")} className={LABEL_CLASS}>
            {t("plataforma.tesoro.form.start")}
          </label>
          <input
            id={id("start")}
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            aria-describedby={startInPast ? id("start-error") : undefined}
            className={FIELD_CLASS}
          />
          {startInPast ? (
            <p id={id("start-error")} role="alert" className="mt-1 text-xs text-error">
              {t("plataforma.tesoro.form.startInPast")}
            </p>
          ) : null}
        </div>
      </div>
      <div>
        <label htmlFor={id("prize")} className={LABEL_CLASS}>
          {t("plataforma.tesoro.form.prize")}
        </label>
        <textarea id={id("prize")} rows={2} value={prize} onChange={(e) => setPrize(e.target.value)} className={FIELD_CLASS} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="min-w-40 flex-1">
          <label htmlFor={id("duration")} className={LABEL_CLASS}>
            {t("plataforma.tesoro.form.duration")}
          </label>
          <input
            id={id("duration")}
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor={id("max")} className={LABEL_CLASS}>
            {t("plataforma.tesoro.form.maxParticipants")}
          </label>
          <input
            id={id("max")}
            type="number"
            min={1}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            aria-describedby={id("max-hint")}
            className={FIELD_CLASS}
          />
          <p id={id("max-hint")} className="mt-1 text-xs text-text-secondary">
            {t("plataforma.tesoro.form.maxParticipantsHint")}
          </p>
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        {game && game.game_mode && game.game_mode !== "individual"
          ? t("plataforma.tesoro.form.legacyModeNote")
          : t("plataforma.tesoro.form.individualOnlyNote")}
      </p>
      <div className="flex items-center gap-2">
        <input id={id("featured")} type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        <label htmlFor={id("featured")} className="text-sm text-text-form">
          {t("plataforma.tesoro.form.featured")}
        </label>
      </div>
      <div>
        <label htmlFor={id("image")} className={LABEL_CLASS}>
          {t("plataforma.tesoro.form.image")}
        </label>
        <input
          id={id("image")}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => handleImage(e.target.files?.[0] ?? null)}
          aria-describedby={id("image-hint")}
          className="text-sm"
        />
        <p id={id("image-hint")} className={`mt-1 text-xs ${imageError ? "text-error" : "text-text-secondary"}`}>
          {imageError
            ? t(IMAGE_ERROR_KEYS[imageError], { max: GAME_IMAGE_MAX_MB })
            : game?.image
              ? t("plataforma.tesoro.form.imageKeepHint", { max: GAME_IMAGE_MAX_MB })
              : t("plataforma.tesoro.form.imageHint", { max: GAME_IMAGE_MAX_MB })}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit || pending}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
