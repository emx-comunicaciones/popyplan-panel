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

import { SurveysError, useSurveys } from "./useSurveys";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useSurveys", () => {
  it("pide las encuestas de la entidad", async () => {
    const survey = buildSurvey();
    // El endpoint **pagina** (`{count, next, previous, results}`), pese a
    // que el esquema y el docstring de este hook lo daban por un array
    // plano: con la forma real, `surveys.data.map` reventaba la página
    // entera de Encuestas. Es la misma clase de fallo que ya escondió el
    // mock de `reports/queue` (ver CLAUDE.md, «Bugs reales encontrados
    // por el e2e»): un mock con la forma equivocada no prueba nada.
    apiFetchMock.mockResolvedValueOnce({
      count: 1, next: null, previous: null, results: [survey],
    });

    const { result } = renderHook(() => useSurveys(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/surveys/?page=1");
    expect(result.current.data).toEqual([survey]);
  });

  it("recorre todas las páginas", async () => {
    const primera = buildSurvey({ id: 1 });
    const segunda = buildSurvey({ id: 2 });
    apiFetchMock
      .mockResolvedValueOnce({
        count: 2, next: "http://x/?page=2", previous: null, results: [primera],
      })
      .mockResolvedValueOnce({ count: 2, next: null, previous: null, results: [segunda] });

    const { result } = renderHook(() => useSurveys(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([primera, segunda]);
    expect(apiFetchMock).toHaveBeenLastCalledWith("/api/panel/entidad/7/surveys/?page=2");
  });

  it("403 surge como sin acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useSurveys(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(SurveysError);
    expect(result.current.error?.message).toMatch(/No tienes acceso/);
  });

  it("cualquier otro fallo surge con mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useSurveys(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("No se pudieron cargar las encuestas.");
  });
});
