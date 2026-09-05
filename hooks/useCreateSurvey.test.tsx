import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { ApiError } from "@/lib/api/client";
import { buildSurvey } from "@/test-utils/fixtures/survey";

import { CreateSurveyError, useCreateSurvey } from "./useCreateSurvey";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCreateSurvey", () => {
  it("manda title, kind periodic, fechas y preguntas", async () => {
    apiFetchMock.mockResolvedValueOnce(buildSurvey());
    const input = {
      title: "Encuesta trimestral",
      kind: "periodic" as const,
      opens_at: "2026-09-01T00:00:00Z",
      closes_at: "2026-09-30T23:59:59Z",
      questions: [{ kind: "stars_1_5" as const, text: "¿Qué te ha parecido?", order: 0 }],
    };

    const { result } = renderHook(() => useCreateSurvey(7), { wrapper });
    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/surveys/", {
      method: "POST",
      body: input,
    });
  });

  it("400 con detalle surge como invalido", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "Pregunta no válida" }));

    const { result } = renderHook(() => useCreateSurvey(7), { wrapper });
    result.current.mutate({
      title: "T",
      kind: "periodic",
      questions: [{ kind: "text_short", text: "?", order: 0 }],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as CreateSurveyError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Pregunta no válida");
  });

  it("400 sin detalle en el cuerpo cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useCreateSurvey(7), { wrapper });
    result.current.mutate({ title: "T", kind: "periodic", questions: [] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as CreateSurveyError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Revisa los datos: alguna pregunta no es válida.");
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useCreateSurvey(7), { wrapper });
    result.current.mutate({ title: "T", kind: "periodic", questions: [] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as CreateSurveyError).kind).toBe("sin_permiso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCreateSurvey(7), { wrapper });
    result.current.mutate({ title: "T", kind: "periodic", questions: [] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as CreateSurveyError).kind).toBe("desconocido");
  });
});
