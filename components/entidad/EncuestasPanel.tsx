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

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCreateSurvey } from "@/hooks/useCreateSurvey";
import { useSurveys } from "@/hooks/useSurveys";
import type { Survey, SurveyQuestionInput, SurveyQuestionKind } from "@/lib/api/types";

export interface EncuestasPanelProps {
  orgId: number | string;
  slug: string;
  canCreate: boolean;
}

const QUESTION_KIND_LABELS: Record<SurveyQuestionKind, string> = {
  stars_1_5: "Estrellas (1-5)",
  scale_4: "Escala (1-4)",
  text_short: "Texto corto",
};

const SURVEY_KIND_LABELS: Record<Survey["kind"], string> = {
  post_event: "Post-actividad",
  periodic: "Periódica",
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
    <Card title="Nueva encuesta periódica">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="survey-title" className="mb-1 block text-sm font-medium text-text-form">
            Título
          </label>
          <input
            id="survey-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
            required
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="survey-opens-at" className="mb-1 block text-sm font-medium text-text-form">
              Abre el
            </label>
            <input
              id="survey-opens-at"
              type="datetime-local"
              value={opensAt}
              onChange={(event) => setOpensAt(event.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
            />
          </div>
          <div>
            <label htmlFor="survey-closes-at" className="mb-1 block text-sm font-medium text-text-form">
              Cierra el
            </label>
            <input
              id="survey-closes-at"
              type="datetime-local"
              value={closesAt}
              onChange={(event) => setClosesAt(event.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-text-form">Preguntas</legend>
          {questions.map((question, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2 rounded-md border border-border-light p-2">
              <div>
                <label
                  htmlFor={`survey-question-kind-${index}`}
                  className="mb-1 block text-xs font-medium text-text-form"
                >
                  Tipo
                </label>
                <select
                  id={`survey-question-kind-${index}`}
                  value={question.kind}
                  onChange={(event) =>
                    updateQuestion(index, { kind: event.target.value as SurveyQuestionKind })
                  }
                  className="rounded-md border border-border px-2 py-1 text-sm focus-visible:outline-primary"
                >
                  {(Object.keys(QUESTION_KIND_LABELS) as SurveyQuestionKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {QUESTION_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label
                  htmlFor={`survey-question-text-${index}`}
                  className="mb-1 block text-xs font-medium text-text-form"
                >
                  Pregunta
                </label>
                <input
                  id={`survey-question-text-${index}`}
                  type="text"
                  value={question.text}
                  onChange={(event) => updateQuestion(index, { text: event.target.value })}
                  className="w-full rounded-md border border-border px-2 py-1 text-sm focus-visible:outline-primary"
                  required
                />
              </div>
              <Button
                type="button"
                variant="danger"
                onClick={() => removeQuestion(index)}
                disabled={questions.length === 1}
              >
                Quitar
              </Button>
            </div>
          ))}
          <div>
            <Button type="button" variant="secondary" onClick={addQuestion}>
              Añadir pregunta
            </Button>
          </div>
        </fieldset>

        <div>
          <Button type="submit" disabled={!canSubmit || createSurvey.isPending}>
            Crear encuesta
          </Button>
        </div>
        {createSurvey.isError ? (
          <p role="alert" className="text-sm text-error">
            {createSurvey.error.message}
          </p>
        ) : null}
        {createSurvey.isSuccess ? <p className="text-sm text-success">Encuesta creada.</p> : null}
      </form>
    </Card>
  );
}

function SurveyList({ orgId, slug }: { orgId: number | string; slug: string }) {
  const surveys = useSurveys(orgId);

  if (surveys.isError) {
    return <ErrorState title="No se pudieron cargar las encuestas" description={surveys.error.message} />;
  }
  if (!surveys.data) {
    return <p className="text-sm text-text-secondary">Cargando encuestas…</p>;
  }
  if (surveys.data.length === 0) {
    return <EmptyState title="Sin encuestas todavía" />;
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
                  <Badge tone="info">{SURVEY_KIND_LABELS[survey.kind]}</Badge>
                  <Badge tone={isSurveyOpen(survey) ? "success" : "neutral"}>
                    {isSurveyOpen(survey) ? "Abierta" : "Cerrada"}
                  </Badge>
                  <Badge tone="neutral">
                    {survey.questions.length} {survey.questions.length === 1 ? "pregunta" : "preguntas"}
                  </Badge>
                </div>
              </div>
              <Link
                href={`/entidad/${slug}/encuestas/${survey.id}`}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Ver resultados
              </Link>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function EncuestasPanel({ orgId, slug, canCreate }: EncuestasPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {canCreate ? <CreateSurveyForm orgId={orgId} /> : null}
      <section aria-labelledby="encuestas-heading">
        <h2 id="encuestas-heading" className="mb-2 text-lg font-semibold text-text-base">
          Encuestas
        </h2>
        <SurveyList orgId={orgId} slug={slug} />
      </section>
    </div>
  );
}
