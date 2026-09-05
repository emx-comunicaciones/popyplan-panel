import type { Survey, SurveyQuestion, SurveyQuestionResult, SurveyResults } from "@/lib/api/types";

export function buildSurveyQuestion(overrides: Partial<SurveyQuestion> = {}): SurveyQuestion {
  return {
    id: 1,
    kind: "stars_1_5",
    text: "¿Qué te ha parecido?",
    order: 0,
    ...overrides,
  };
}

export function buildSurvey(overrides: Partial<Survey> = {}): Survey {
  return {
    id: 3,
    title: "Encuesta de satisfacción trimestral",
    kind: "periodic",
    event: null,
    community: null,
    anonymous: true,
    opens_at: "2026-09-01T00:00:00Z",
    closes_at: "2026-09-30T23:59:59Z",
    created_at: "2026-09-01T09:00:00Z",
    questions: [buildSurveyQuestion()],
    ...overrides,
  };
}

export function buildSurveyQuestionResult(
  overrides: Partial<SurveyQuestionResult> = {},
): SurveyQuestionResult {
  return {
    question_id: 1,
    kind: "stars_1_5",
    text: "¿Qué te ha parecido?",
    mean: 4.2,
    distribution: { "1": 0, "2": 0, "3": 1, "4": 2, "5": 2 },
    suppressed: false,
    ...overrides,
  };
}

export function buildSurveyResults(overrides: Partial<SurveyResults> = {}): SurveyResults {
  return {
    survey_id: 3,
    responses_count: 5,
    questions: [buildSurveyQuestionResult()],
    ...overrides,
  };
}
