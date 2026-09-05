import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildSurveyQuestionResult, buildSurveyResults } from "@/test-utils/fixtures/survey";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useSurveyResultsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useSurveyResults", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useSurveyResults")>(
    "@/hooks/useSurveyResults",
  );
  return { ...actual, useSurveyResults: useSurveyResultsMock };
});

import EntidadSurveyResultsPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useSurveyResultsMock.mockReset();
});

async function renderPage(role = "titular", slug = "alfaville", surveyId = "3") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadSurveyResultsPage({ params: Promise.resolve({ slug, surveyId }) });
  return render(element);
}

describe("EntidadSurveyResultsPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    useSurveyResultsMock.mockReturnValue({ data: buildSurveyResults(), isError: false, error: null });

    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("muestra el banner de anonimato y los resultados agregados", async () => {
    useSurveyResultsMock.mockReturnValue({ data: buildSurveyResults(), isError: false, error: null });

    await renderPage();

    expect(screen.getByText("Las respuestas son anónimas y agregadas.")).toBeInTheDocument();
    expect(screen.getByText("¿Qué te ha parecido?")).toBeInTheDocument();
    expect(screen.getByText("5 respuestas en total.")).toBeInTheDocument();
    expect(screen.getByText(/Media:/)).toBeInTheDocument();
  });

  it("pregunta suprimida (<5) no muestra la media ni la distribución", async () => {
    useSurveyResultsMock.mockReturnValue({
      data: buildSurveyResults({
        responses_count: 3,
        questions: [
          buildSurveyQuestionResult({ mean: null, distribution: null, suppressed: true }),
        ],
      }),
      isError: false,
      error: null,
    });

    await renderPage();

    expect(screen.getAllByText("<5").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Media:/)).not.toBeInTheDocument();
  });

  it("pregunta text_short muestra las respuestas como lista sin orden", async () => {
    useSurveyResultsMock.mockReturnValue({
      data: buildSurveyResults({
        questions: [
          buildSurveyQuestionResult({
            question_id: 2,
            kind: "text_short",
            text: "¿Algo que mejorar?",
            mean: undefined,
            distribution: undefined,
            answers: ["Más sillas", "Todo genial"],
            suppressed: false,
          }),
        ],
      }),
      isError: false,
      error: null,
    });

    await renderPage();

    expect(screen.getByText("Más sillas")).toBeInTheDocument();
    expect(screen.getByText("Todo genial")).toBeInTheDocument();
  });

  it("estado de error pinta ErrorState", async () => {
    useSurveyResultsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar los resultados."),
    });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar los resultados");
  });

  it("dinamizador puede ver los resultados (Encuestas no está oculta para su rol)", async () => {
    useSurveyResultsMock.mockReturnValue({ data: buildSurveyResults(), isError: false, error: null });

    await renderPage("dinamizador");

    expect(screen.getByText("Las respuestas son anónimas y agregadas.")).toBeInTheDocument();
  });

  it("analista ve «Sin acceso»", async () => {
    await renderPage("analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadSurveyResultsPage({ params: Promise.resolve({ slug: "alfaville", surveyId: "3" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>));
  });

  it("sin membresía en esa entidad redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: { role: null },
    });

    await expect(
      EntidadSurveyResultsPage({
        params: Promise.resolve({ slug: "otra-entidad", surveyId: "3" }),
      }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
