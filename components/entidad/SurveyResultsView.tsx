"use client";

/**
 * Resultados agregados de una encuesta (tarea W4b, `docs/PANEL.md` §6.6):
 * por pregunta, media + distribución (barras, `recharts`) para
 * `stars_1_5`/`scale_4`, lista sin orden para `text_short`; con menos de
 * `PANEL_MIN_GROUP_SIZE` respuestas la pregunta llega `suppressed: true`
 * (mean/distribution/answers en `null`) y se pinta como «<5», nunca como
 * vacío. Banner explícito de anonimato siempre visible, sea cual sea el
 * estado de la consulta con datos.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useSurveyResults } from "@/hooks/useSurveyResults";
import type { SurveyQuestionResult } from "@/lib/api/types";

export interface SurveyResultsViewProps {
  orgId: number | string;
  surveyId: number | string;
}

const ANONYMITY_BANNER = "Las respuestas son anónimas y agregadas.";

function distributionData(distribution: Record<string, unknown> | null | undefined): {
  value: string;
  count: number;
}[] {
  if (!distribution) return [];
  return Object.entries(distribution)
    .map(([value, count]) => ({ value, count: typeof count === "number" ? count : Number(count) }))
    .sort((a, b) => Number(a.value) - Number(b.value));
}

function DistributionChart({ distribution }: { distribution: Record<string, unknown> | null | undefined }) {
  const data = distributionData(distribution);
  return (
    <div role="img" aria-label="Distribución de respuestas" style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="value" stroke="var(--color-text-secondary)" />
          <YAxis allowDecimals={false} stroke="var(--color-text-secondary)" />
          <Tooltip />
          <Bar dataKey="count" name="Respuestas" fill="var(--color-primary)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QuestionResult({ question }: { question: SurveyQuestionResult }) {
  return (
    <Card title={question.text}>
      {question.suppressed ? (
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{"<5"}</Badge>
          <p className="text-sm text-text-secondary">
            Datos insuficientes para mostrar el resultado (menos de 5 respuestas).
          </p>
        </div>
      ) : question.kind === "text_short" ? (
        question.answers && question.answers.length > 0 ? (
          <ul className="list-disc pl-5 text-sm text-text-base">
            {question.answers.map((answer, index) => (
              <li key={index}>{answer}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">Sin respuestas todavía.</p>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-base">
            Media: <span className="font-semibold">{question.mean?.toFixed(1) ?? "—"}</span>
          </p>
          <DistributionChart distribution={question.distribution} />
        </div>
      )}
    </Card>
  );
}

export function SurveyResultsView({ orgId, surveyId }: SurveyResultsViewProps) {
  const results = useSurveyResults(orgId, surveyId);

  return (
    <div className="flex flex-col gap-4">
      <p role="note" className="rounded-md border border-border bg-category-light p-3 text-sm text-text-base">
        {ANONYMITY_BANNER}
      </p>

      {results.isError ? (
        <ErrorState title="No se pudieron cargar los resultados" description={results.error.message} />
      ) : !results.data ? (
        <p className="text-sm text-text-secondary">Cargando resultados…</p>
      ) : results.data.questions.length === 0 ? (
        <EmptyState title="Sin preguntas" />
      ) : (
        <>
          <p className="text-sm text-text-secondary">
            {results.data.responses_count}{" "}
            {results.data.responses_count === 1 ? "respuesta" : "respuestas"} en total.
          </p>
          <div className="flex flex-col gap-4">
            {results.data.questions.map((question) => (
              <QuestionResult key={question.question_id} question={question} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
