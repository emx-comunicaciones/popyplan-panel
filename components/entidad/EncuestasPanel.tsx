"use client";

/**
 * Encuestas de la entidad (tarea W4b, `docs/PANEL.md` §6): lista (título,
 * tipo, estado abierta/cerrada) y creación de una encuesta periódica
 * (título, fechas, preguntas). Las encuestas `post_event` las crea el
 * backend automáticamente al completar una actividad (§6.3): esta página
 * no ofrece crearlas a mano. Solo titular/moderador pueden crear
 * (`canCreate`); el resto de roles con acceso (dinamizador) solo ve la
 * lista y puede entrar a los resultados agregados.
 */
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCreateSurvey, type CreateSurveyErrorKind } from "@/hooks/useCreateSurvey";
import { useSurveys, type SurveysErrorKind } from "@/hooks/useSurveys";
import { errorKindText } from "@/lib/i18n/errorKindText";
import type { Survey, SurveyQuestionInput, SurveyQuestionKind } from "@/lib/api/types";

export interface EncuestasPanelProps {
  orgId: number | string;
  slug: string;
  canCreate: boolean;
}

const QUESTION_KIND_KEYS: Record<SurveyQuestionKind, string> = {
  stars_1_5: "entidad.encuestas.questionKind.stars",
  scale_4: "entidad.encuestas.questionKind.scale",
  text_short: "entidad.encuestas.questionKind.text",
};

const SURVEY_KIND_KEYS: Record<Survey["kind"], string> = {
  post_event: "entidad.encuestas.surveyKind.postEvent",
  periodic: "entidad.encuestas.surveyKind.periodic",
};

const SURVEYS_ERROR_KEYS: Record<SurveysErrorKind, string> = {
  sin_acceso: "errors.surveys.sinAcceso",
  demasiadas_paginas: "errors.surveys.demasiadasPaginas",
  desconocido: "errors.surveys.desconocido",
};

const CREATE_SURVEY_ERROR_KEYS: Record<CreateSurveyErrorKind, string> = {
  invalido: "errors.createSurvey.invalido",
  sin_permiso: "errors.createSurvey.sinPermiso",
  desconocido: "errors.createSurvey.desconocido",
};

export function isSurveyOpen(survey: Pick<Survey, "opens_at" | "closes_at">, now: Date = new Date()): boolean {
  if (new Date(survey.opens_at) > now) return false;
  if (!survey.closes_at) return true;
  return new Date(survey.closes_at) > now;
}

function toIso(localDateTime: string): string | undefined {
  if (!localDateTime) return undefined;
  const date = new Date(localDateTime);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function CreateSurveyForm({ orgId }: { orgId: number | string }) {
  const t = useTranslations();
  const createSurvey = useCreateSurvey(orgId);
  const [title, setTitle] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [questions, setQuestions] = useState<SurveyQuestionInput[]>([
    { kind: "stars_1_5", text: "", order: 0 },
  ]);

  function updateQuestion(index: number, patch: Partial<SurveyQuestionInput>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { kind: "stars_1_5", text: "", order: prev.length }]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i })));
  }

  const canSubmit =
    title.trim().length > 0 && questions.length > 0 && questions.every((q) => q.text.trim().length > 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    createSurvey.mutate(
      {
        title,
        kind: "periodic",
        opens_at: toIso(opensAt),
        closes_at: toIso(closesAt),
        questions: questions.map((q, i) => ({ ...q, order: i })),
      },
      {
        onSuccess: () => {
          setTitle("");
          setOpensAt("");
          setClosesAt("");
          setQuestions([{ kind: "stars_1_5", text: "", order: 0 }]);
        },
      },
    );
  }

  return (
    <Card title={t("entidad.encuestas.newSurveyTitle")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="survey-title" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.encuestas.titleLabel")}
          </label>
          <input
            id="survey-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            required
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="survey-opens-at" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.encuestas.opensAtLabel")}
            </label>
            <input
              id="survey-opens-at"
              type="datetime-local"
              value={opensAt}
              onChange={(event) => setOpensAt(event.target.value)}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
          </div>
          <div>
            <label htmlFor="survey-closes-at" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.encuestas.closesAtLabel")}
            </label>
            <input
              id="survey-closes-at"
              type="datetime-local"
              value={closesAt}
              onChange={(event) => setClosesAt(event.target.value)}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-text-form">
            {t("entidad.encuestas.questionsLegend")}
          </legend>
          {questions.map((question, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2 rounded-md border border-border-light p-2">
              <div>
                <label
                  htmlFor={`survey-question-kind-${index}`}
                  className="mb-1 block text-xs font-medium text-text-form"
                >
                  {t("entidad.encuestas.questionKindLabel")}
                </label>
                <select
                  id={`survey-question-kind-${index}`}
                  value={question.kind}
                  onChange={(event) =>
                    updateQuestion(index, { kind: event.target.value as SurveyQuestionKind })
                  }
                  className="rounded-md border border-border px-2 py-1 text-sm focus-visible:outline-primary-700"
                >
                  {(Object.keys(QUESTION_KIND_KEYS) as SurveyQuestionKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {t(QUESTION_KIND_KEYS[kind])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label
                  htmlFor={`survey-question-text-${index}`}
                  className="mb-1 block text-xs font-medium text-text-form"
                >
                  {t("entidad.encuestas.questionTextLabel")}
                </label>
                <input
                  id={`survey-question-text-${index}`}
                  type="text"
                  value={question.text}
                  onChange={(event) => updateQuestion(index, { text: event.target.value })}
                  className="w-full rounded-md border border-border px-2 py-1 text-sm focus-visible:outline-primary-700"
                  required
                />
              </div>
              <Button
                type="button"
                variant="danger"
                onClick={() => removeQuestion(index)}
                disabled={questions.length === 1}
              >
                {t("entidad.encuestas.removeQuestion")}
              </Button>
            </div>
          ))}
          <div>
            <Button type="button" variant="secondary" onClick={addQuestion}>
              {t("entidad.encuestas.addQuestion")}
            </Button>
          </div>
        </fieldset>

        <div>
          <Button type="submit" disabled={!canSubmit || createSurvey.isPending}>
            {t("entidad.encuestas.createSurvey")}
          </Button>
        </div>
        {createSurvey.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(
              createSurvey.error,
              CREATE_SURVEY_ERROR_KEYS,
              t,
              "errors.createSurvey.desconocido",
            )}
          </p>
        ) : null}
        {createSurvey.isSuccess ? (
          <p className="text-sm text-success">{t("entidad.encuestas.createSuccess")}</p>
        ) : null}
      </form>
    </Card>
  );
}

function SurveyList({ orgId, slug }: { orgId: number | string; slug: string }) {
  const t = useTranslations();
  const surveys = useSurveys(orgId);

  if (surveys.isError) {
    return (
      <ErrorState
        title={t("entidad.encuestas.listError")}
        description={errorKindText(surveys.error, SURVEYS_ERROR_KEYS, t, "errors.surveys.desconocido")}
      />
    );
  }
  if (!surveys.data) {
    return <p className="text-sm text-text-secondary">{t("entidad.encuestas.loading")}</p>;
  }
  if (surveys.data.length === 0) {
    return <EmptyState title={t("entidad.encuestas.empty")} />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {surveys.data.map((survey) => (
        <li key={survey.id}>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-text-base">{survey.title}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge tone="info">{t(SURVEY_KIND_KEYS[survey.kind])}</Badge>
                  <Badge tone={isSurveyOpen(survey) ? "success" : "neutral"}>
                    {isSurveyOpen(survey)
                      ? t("entidad.encuestas.open")
                      : t("entidad.encuestas.closed")}
                  </Badge>
                  <Badge tone="neutral">
                    {t("entidad.encuestas.questionCount", { count: survey.questions.length })}
                  </Badge>
                </div>
              </div>
              <Link
                href={`/entidad/${slug}/encuestas/${survey.id}`}
                className="text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
              >
                {t("entidad.encuestas.viewResults")}
              </Link>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function EncuestasPanel({ orgId, slug, canCreate }: EncuestasPanelProps) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-4">
      {canCreate ? <CreateSurveyForm orgId={orgId} /> : null}
      <section aria-labelledby="encuestas-heading">
        <h2 id="encuestas-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("entidad.encuestas.listHeading")}
        </h2>
        <SurveyList orgId={orgId} slug={slug} />
      </section>
    </div>
  );
}
