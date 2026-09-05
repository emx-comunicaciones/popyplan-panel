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
import { buildSurveyResults } from "@/test-utils/fixtures/survey";

import { SurveyResultsError, useSurveyResults } from "./useSurveyResults";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useSurveyResults", () => {
  it("pide los resultados agregados de la encuesta", async () => {
    const results = buildSurveyResults();
    apiFetchMock.mockResolvedValueOnce(results);

    const { result } = renderHook(() => useSurveyResults(7, 3), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/surveys/3/results/");
    expect(result.current.data).toEqual(results);
  });

  it("403 surge como sin_acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useSurveyResults(7, 3), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as SurveyResultsError).kind).toBe("sin_acceso");
  });

  it("404 surge como no_encontrada", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));

    const { result } = renderHook(() => useSurveyResults(7, 3), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as SurveyResultsError).kind).toBe("no_encontrada");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useSurveyResults(7, 3), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as SurveyResultsError).kind).toBe("desconocido");
  });

  it("sin surveyId no se dispara la consulta", () => {
    const { result } = renderHook(() => useSurveyResults(7, ""), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });
});
