import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildSurvey } from "@/test-utils/fixtures/survey";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useSurveysMock = vi.hoisted(() => vi.fn());
const useCreateSurveyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useSurveys", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useSurveys")>("@/hooks/useSurveys");
  return { ...actual, useSurveys: useSurveysMock };
});
vi.mock("@/hooks/useCreateSurvey", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCreateSurvey")>(
    "@/hooks/useCreateSurvey",
  );
  return { ...actual, useCreateSurvey: useCreateSurveyMock };
});

import EntidadEncuestasPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useSurveysMock.mockReset();
  useCreateSurveyMock.mockReset();
});

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadEncuestasPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadEncuestasPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Encuestas");
  });

  it("titular ve el formulario de creación y la lista con enlace a resultados", async () => {
    useSurveysMock.mockReturnValue({ data: [buildSurvey()], isError: false, error: null });
    useCreateSurveyMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    await renderPage("titular");

    expect(screen.getByRole("heading", { name: "Encuestas", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear encuesta" })).toBeInTheDocument();
    expect(screen.getByText("Encuesta de satisfacción trimestral")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Ver resultados" });
    expect(link).toHaveAttribute("href", "/entidad/alfaville/encuestas/3");
  });

  it("crear una encuesta manda kind 'periodic' y las preguntas con su orden", async () => {
    const mutate = vi.fn();
    useSurveysMock.mockReturnValue({ data: [], isError: false, error: null });
    useCreateSurveyMock.mockReturnValue({ mutate, isPending: false, isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.type(screen.getByLabelText("Título"), "Encuesta trimestral");
    await user.type(screen.getByLabelText("Pregunta"), "¿Qué tal?");
    await user.click(screen.getByRole("button", { name: "Crear encuesta" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Encuesta trimestral",
        kind: "periodic",
        questions: [{ kind: "stars_1_5", text: "¿Qué tal?", order: 0 }],
      }),
      expect.anything(),
    );
  });

  it("añadir y quitar preguntas cambia la lista de preguntas del formulario", async () => {
    useSurveysMock.mockReturnValue({ data: [], isError: false, error: null });
    useCreateSurveyMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    const user = userEvent.setup();
    await renderPage("titular");

    await user.click(screen.getByRole("button", { name: "Añadir pregunta" }));
    expect(screen.getAllByLabelText("Pregunta")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Quitar" })[0]);
    expect(screen.getAllByLabelText("Pregunta")).toHaveLength(1);
  });

  it("moderador también ve el formulario de creación", async () => {
    useSurveysMock.mockReturnValue({ data: [], isError: false, error: null });
    useCreateSurveyMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    await renderPage("moderador");

    expect(screen.getByRole("button", { name: "Crear encuesta" })).toBeInTheDocument();
  });

  it("dinamizador ve la lista pero no el formulario de creación", async () => {
    useSurveysMock.mockReturnValue({ data: [buildSurvey()], isError: false, error: null });

    await renderPage("dinamizador");

    expect(screen.queryByRole("button", { name: "Crear encuesta" })).not.toBeInTheDocument();
    expect(screen.getByText("Encuesta de satisfacción trimestral")).toBeInTheDocument();
  });

  it("sin encuestas muestra el estado vacío", async () => {
    useSurveysMock.mockReturnValue({ data: [], isError: false, error: null });
    useCreateSurveyMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    await renderPage("titular");

    expect(screen.getByText("Sin encuestas todavía")).toBeInTheDocument();
  });

  it("estado de error pinta ErrorState", async () => {
    useSurveysMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar las encuestas."),
    });
    useCreateSurveyMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null });

    await renderPage("titular");

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las encuestas");
  });

  it("analista ve «Sin acceso»", async () => {
    await renderPage("analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadEncuestasPage({ params: Promise.resolve({ slug: "alfaville" }) }),
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
      EntidadEncuestasPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
