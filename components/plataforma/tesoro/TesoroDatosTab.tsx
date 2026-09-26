"use client";

/**
 * Pestaña «Datos» de la ficha de un juego: resumen, ciclo de vida y
 * edición.
 *
 * - **Ciclo de vida** (`draft → open → in_progress → finished`, siempre
 *   hacia delante): un solo botón según el estado, con `ConfirmDialog` y el
 *   error dentro. «Abrir inscripciones» es el que **publica** el juego:
 *   ahí nace su actividad en la agenda (`event_id`). «Empezar» exige al
 *   menos una prueba (el backend responde 400 sin ninguna; el botón ya se
 *   deshabilita con `steps_count === 0` y lo dice).
 * - **Actividad enlazada**: con `event_id`, se pinta la actividad espejo
 *   (`GET /api/events/{id}/`: título, estado, inicio). Un borrador no la
 *   tiene y la pestaña lo explica en vez de dejar un hueco.
 * - **Edición**: `TesoroJuegoForm` con `key` derivada de los propios
 *   valores editables (`formKey`), así que cuando llegan datos nuevos del
 *   backend el formulario se remonta con ellos (mismo remedio que el
 *   hallazgo A3 de `ResourceForm`). Un contador incrementado en el
 *   `onSuccess` no valía: remontaba antes de que la caché notificara el
 *   detalle nuevo y el formulario se quedaba con los valores viejos.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useEvent } from "@/hooks/useEvent";
import { useTreasureLifecycle, useUpdateTreasureGame, type TreasureLifecycleAction } from "@/hooks/useTreasureHuntMutations";
import type { TreasureGameDetail } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { EVENT_STATUS_KEYS } from "../ActividadesPlataformaTable";
import { TesoroJuegoForm } from "./TesoroJuegoForm";
import { TREASURE_ERROR_FALLBACK, TREASURE_ERROR_KEYS, formatDateTime } from "./shared";

const NEXT_ACTION: Partial<Record<string, TreasureLifecycleAction>> = {
  draft: "open",
  open: "start",
  in_progress: "finish",
};

const ACTION_KEYS: Record<TreasureLifecycleAction, { label: string; title: string; description: string }> = {
  open: {
    label: "plataforma.tesoroFicha.datos.open",
    title: "plataforma.tesoroFicha.datos.openTitle",
    description: "plataforma.tesoroFicha.datos.openDescription",
  },
  start: {
    label: "plataforma.tesoroFicha.datos.start",
    title: "plataforma.tesoroFicha.datos.startTitle",
    description: "plataforma.tesoroFicha.datos.startDescription",
  },
  finish: {
    label: "plataforma.tesoroFicha.datos.finish",
    title: "plataforma.tesoroFicha.datos.finishTitle",
    description: "plataforma.tesoroFicha.datos.finishDescription",
  },
};

function formKey(game: TreasureGameDetail): string {
  return [
    game.id,
    game.name,
    game.description,
    game.city,
    game.prize_description,
    game.start_time,
    game.duration_minutes,
    game.max_participants,
    game.is_featured,
    game.image,
  ].join("|");
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-medium text-text-form">{label}</dt>
      <dd className="text-text-base">{children}</dd>
    </div>
  );
}

function LinkedActivity({ eventId }: { eventId: string }) {
  const t = useTranslations();
  const event = useEvent(eventId);
  if (event.isError) {
    return <p className="text-sm text-text-secondary">{t("plataforma.tesoroFicha.datos.activityLoadError")}</p>;
  }
  if (!event.data) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }
  const statusKey = EVENT_STATUS_KEYS[event.data.status as keyof typeof EVENT_STATUS_KEYS];
  return (
    <dl className="flex flex-col gap-1 text-sm">
      <Row label={t("plataforma.tesoroFicha.datos.activityTitle")}>{event.data.title}</Row>
      <Row label={t("plataforma.tesoroFicha.datos.activityStatus")}>
        <Badge tone="info">{statusKey ? t(statusKey) : event.data.status}</Badge>
      </Row>
      <Row label={t("plataforma.tesoroFicha.datos.activityStart")}>{formatDateTime(event.data.starts_at)}</Row>
      <Row label={t("plataforma.tesoroFicha.datos.activityId")}>
        <span className="font-mono text-xs">{eventId}</span>
      </Row>
    </dl>
  );
}

export function TesoroDatosTab({ game }: { game: TreasureGameDetail }) {
  const t = useTranslations();
  const lifecycle = useTreasureLifecycle(game.id);
  const update = useUpdateTreasureGame(game.id);
  const [confirming, setConfirming] = useState<TreasureLifecycleAction | null>(null);

  const nextAction = game.status ? NEXT_ACTION[game.status] : undefined;
  const startBlocked = nextAction === "start" && game.steps_count === 0;

  function closeConfirm() {
    lifecycle.reset();
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("plataforma.tesoroFicha.datos.summaryTitle")}>
        <dl className="flex flex-col gap-1 text-sm">
          <Row label={t("plataforma.tesoro.startHeader")}>{formatDateTime(game.start_time)}</Row>
          <Row label={t("plataforma.tesoro.form.city")}>{game.city}</Row>
          <Row label={t("plataforma.tesoro.participantsHeader")}>
            {game.max_participants
              ? t("plataforma.tesoro.participantsOf", { count: game.participants_count, max: game.max_participants })
              : String(game.participants_count)}
          </Row>
          <Row label={t("plataforma.tesoro.stepsHeader")}>{String(game.steps_count)}</Row>
          <Row label={t("plataforma.tesoroFicha.datos.createdBy")}>{game.created_by_username || "—"}</Row>
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {nextAction ? (
            <Button type="button" disabled={startBlocked} onClick={() => setConfirming(nextAction)}>
              {t(ACTION_KEYS[nextAction].label)}
            </Button>
          ) : (
            <p className="text-sm text-text-secondary">{t("plataforma.tesoroFicha.datos.noNextAction")}</p>
          )}
        </div>
        {startBlocked ? (
          <p className="mt-2 text-xs text-text-secondary">{t("plataforma.tesoroFicha.datos.startNeedsSteps")}</p>
        ) : null}
      </Card>

      <Card title={t("plataforma.tesoroFicha.datos.activityCardTitle")}>
        {game.event_id ? (
          <LinkedActivity eventId={game.event_id} />
        ) : (
          <p className="text-sm text-text-secondary">{t("plataforma.tesoroFicha.datos.noActivity")}</p>
        )}
      </Card>

      <Card title={t("plataforma.tesoroFicha.datos.editTitle")}>
        <TesoroJuegoForm
          key={formKey(game)}
          game={game}
          idPrefix="tesoro-editar"
          pending={update.isPending}
          submitLabel={t("common.save")}
          error={update.isError ? errorKindText(update.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK) : undefined}
          onSubmit={(input) => update.mutate(input)}
        />
        {update.isSuccess ? (
          <p role="status" className="mt-2 text-sm text-success">
            {t("plataforma.tesoroFicha.datos.saved")}
          </p>
        ) : null}
      </Card>

      {confirming ? (
        <ConfirmDialog
          open
          title={t(ACTION_KEYS[confirming].title)}
          description={
            <>
              <span>{t(ACTION_KEYS[confirming].description)}</span>
              {lifecycle.isError ? (
                <span role="alert" className="mt-2 block text-error">
                  {errorKindText(lifecycle.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
                </span>
              ) : null}
            </>
          }
          confirmLabel={t(ACTION_KEYS[confirming].label)}
          pending={lifecycle.isPending}
          onCancel={closeConfirm}
          onConfirm={() => lifecycle.mutate(confirming, { onSuccess: () => setConfirming(null) })}
        />
      ) : null}
    </div>
  );
}
