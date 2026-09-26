"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useProposeGoal, useSharedTracking } from "@/hooks/useSharedTracking";
import type { SharedCheckin, SharedTracking } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeForUseLocale } from "@/lib/i18n/locale";
import { CHECKIN_FLAGS, labelOrRaw, moodKey, trackingTypeText, urgeKey } from "@/lib/tracking/labels";

const SHARED_TRACKING_ERROR_KEYS = {
  sin_acceso: "errors.sharedTracking.sinAcceso",
  desconocido: "errors.sharedTracking.desconocido",
} as const;

const PROPOSE_GOAL_ERROR_KEYS = {
  invalido: "errors.proposeGoal.invalido",
  sin_acceso: "errors.proposeGoal.sinAcceso",
  desconocido: "errors.proposeGoal.desconocido",
} as const;

/** El texto de la pregunta de ganas depende del tipo (spec: consumir / apostar o jugar / genérico). */
const URGE_HEADING_KEYS: Record<string, string> = {
  alcohol: "urgeHeadingSubstance",
  drugs: "urgeHeadingSubstance",
  gambling: "urgeHeadingGambling",
};

export interface SharedTrackingSectionProps {
  orgId: number | string;
  userId: number | string;
  /**
   * `role === 'referente'` **y** servicio encendido: sin las dos cosas el
   * hook ni se dispara (cada lectura queda en `AuditLog`, y cualquier otro
   * rol recibiría un 404 que no hay por qué provocar).
   */
  enabled: boolean;
}

/**
 * «Seguimiento compartido» (`docs/PANEL.md` §18.6): lo que la persona
 * decide compartir con su **referente asignado**, y solo eso. Mismas
 * reglas que la «Red de apoyo»: mientras carga, o con 404/403 (no es su
 * referente, la inscripción está pendiente, el servicio está apagado…),
 * **no se pinta nada**, ni la cabecera — que exista la sección ya
 * revelaría que la persona está en el programa. Solo se pintan las
 * secciones que llegan distintas de `null` (consentidas); nunca notas ni
 * interrupciones (el backend no las manda).
 */
export function SharedTrackingSection({ orgId, userId, enabled }: SharedTrackingSectionProps) {
  const shared = useSharedTracking(orgId, userId, enabled);
  const t = useTranslations("entidad.seguimiento");
  const tAll = useTranslations();

  if (!enabled || shared.isPending) return null;
  if (shared.isError && shared.error.kind === "sin_acceso") return null;

  return (
    <section aria-labelledby="seguimiento-compartido-heading" className="flex flex-col gap-3">
      <h2 id="seguimiento-compartido-heading" className="text-lg font-semibold text-text-base">
        {t("sharedHeading")}
      </h2>
      <p className="text-sm text-text-secondary">{t("sharedNotice")}</p>
      {shared.isError ? (
        <ErrorState
          title={t("sharedLoadErrorTitle")}
          description={errorKindText(shared.error, SHARED_TRACKING_ERROR_KEYS, tAll, "errors.sharedTracking.desconocido")}
        />
      ) : (
        <SharedContent data={shared.data} />
      )}
      {shared.isError ? null : <ProposeGoalForm orgId={orgId} userId={userId} />}
    </section>
  );
}

function SharedContent({ data }: { data: SharedTracking }) {
  const t = useTranslations("entidad.seguimiento");
  const tAll = useTranslations();
  const locale = useLocale();
  const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(localeForUseLocale(locale));

  const nothing =
    data.checkins === null &&
    data.urges === null &&
    data.goals === null &&
    data.participation === null &&
    data.general_state === null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-base">
        {trackingTypeText(data.tracking_type, data.tracking_label, tAll)} ·{" "}
        {t("sharedWindow", { since: formatDate(data.window.since), until: formatDate(data.window.until) })}
      </p>

      {nothing ? <EmptyState title={t("sharedNothing")} /> : null}

      {data.general_state ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-text-base">{t("generalStateHeading")}</h3>
          <p className="text-sm text-text-base">
            {t("lastMood", {
              mood: data.general_state.last_mood
                ? labelOrRaw(moodKey(data.general_state.last_mood), data.general_state.last_mood, tAll)
                : t("noMood"),
            })}
          </p>
          {data.general_state.weeks.length > 0 ? (
            <Table
              caption={t("weeksCaption")}
              rows={data.general_state.weeks}
              getRowKey={(row) => row.week_start}
              columns={[
                { key: "week", header: t("colWeek"), render: (row) => formatDate(row.week_start) },
                { key: "good", header: tAll("tracking.mood.good"), render: (row) => row.good },
                { key: "so_so", header: tAll("tracking.mood.soSo"), render: (row) => row.so_so },
                { key: "hard", header: tAll("tracking.mood.hard"), render: (row) => row.hard },
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {data.checkins ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-text-base">{t("checkinsHeading")}</h3>
          {data.checkins.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("noCheckins")}</p>
          ) : (
            <Table<SharedCheckin>
              caption={t("checkinsCaption")}
              rows={data.checkins}
              getRowKey={(row) => row.date}
              columns={[
                { key: "date", header: t("colDate"), render: (row) => formatDate(row.date) },
                {
                  key: "mood",
                  header: t("colMood"),
                  render: (row) => labelOrRaw(moodKey(row.mood), row.mood, tAll),
                },
                {
                  key: "flags",
                  header: t("colFlags"),
                  render: (row) =>
                    CHECKIN_FLAGS.filter(([field]) => row[field])
                      .map(([, key]) => tAll(key))
                      .join(" · ") || "—",
                },
              ]}
            />
          )}
        </div>
      ) : null}

      {data.urges ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-text-base">
            {t(URGE_HEADING_KEYS[data.tracking_type] ?? "urgeHeadingOther")}
          </h3>
          {data.urges.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("noUrges")}</p>
          ) : (
            <Table
              caption={t(URGE_HEADING_KEYS[data.tracking_type] ?? "urgeHeadingOther")}
              rows={data.urges}
              getRowKey={(row) => row.date}
              columns={[
                { key: "date", header: t("colDate"), render: (row) => formatDate(row.date) },
                { key: "urge", header: t("colUrge"), render: (row) => labelOrRaw(urgeKey(row.urge), row.urge, tAll) },
              ]}
            />
          )}
        </div>
      ) : null}

      {data.goals ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-text-base">{t("goalsHeading")}</h3>
          {data.goals.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("noGoals")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data.goals.map((goal, index) => (
                <li key={`${goal.week_start}-${index}`} className="flex flex-wrap items-center gap-2 text-sm text-text-base">
                  <span className="text-text-secondary">{t("goalWeek", { date: formatDate(goal.week_start) })}</span>
                  <span>{goal.title}</span>
                  <Badge tone={goal.done ? "success" : "neutral"}>{goal.done ? t("goalDone") : t("goalPending")}</Badge>
                  {goal.proposed ? <Badge tone="info">{t("goalProposed")}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {data.participation ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-text-base">{t("participationHeading")}</h3>
          <p className="text-sm text-text-base">
            {t("participationActivities", { count: data.participation.attended_activities })} ·{" "}
            {t("participationWorkouts", { count: data.participation.workouts })}
          </p>
          <p className="text-xs text-text-secondary">
            {t("participationWindow", { days: data.participation.window_days })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ProposeGoalForm({ orgId, userId }: { orgId: number | string; userId: number | string }) {
  const [title, setTitle] = useState("");
  const proposeGoal = useProposeGoal(orgId, userId);
  const t = useTranslations("entidad.seguimiento");
  const tAll = useTranslations();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    proposeGoal.mutate({ title: value }, { onSuccess: () => setTitle("") });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-text-base">{t("proposeHeading")}</h3>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-60 flex-1">
          <label htmlFor="propose-goal-title" className="mb-1 block text-sm font-medium text-text-form">
            {t("proposeLabel")}
          </label>
          <input
            id="propose-goal-title"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            aria-describedby="propose-goal-hint"
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <Button type="submit" disabled={proposeGoal.isPending || title.trim() === ""}>
          {proposeGoal.isPending ? t("proposing") : t("proposeSubmit")}
        </Button>
      </div>
      <p id="propose-goal-hint" className="text-xs text-text-secondary">
        {t("proposeHint")}
      </p>
      {proposeGoal.isSuccess ? <p className="text-sm text-success">{t("proposed")}</p> : null}
      {proposeGoal.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(proposeGoal.error, PROPOSE_GOAL_ERROR_KEYS, tAll, "errors.proposeGoal.desconocido")}
        </p>
      ) : null}
    </form>
  );
}
