/**
 * `REVIEWS.LIST` y `REVIEWS.DETAIL` (admin de plataforma, bloque 3). El
 * listado usa la paginación estándar (no el doble envoltorio del
 * esquema) y el borrado responde 200 `{message}`.
 */
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
import { buildPlatformReview } from "@/test-utils/fixtures/platformCommunity";

import { ReviewsAdminError, useDeleteReview, useReviewsAdmin } from "./useReviewsAdmin";

afterEach(() => {
  apiFetchMock.mockReset();
});

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
function freshClient() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return queryClient;
}

describe("useReviewsAdmin", () => {
  it("pide la página", async () => {
    freshClient();
    const data = { count: 1, next: null, previous: null, results: [buildPlatformReview()] };
    apiFetchMock.mockResolvedValueOnce(data);
    const { result } = renderHook(() => useReviewsAdmin(2), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/reviews/?page=2");
    expect(result.current.data).toEqual(data);
  });

  it.each([
    [403, "sin_acceso"],
    [404, "pagina_inexistente"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => useReviewsAdmin(1), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ReviewsAdminError);
    expect(result.current.error?.kind).toBe(kind);
  });
});

describe("useDeleteReview", () => {
  it("borra e invalida el listado", async () => {
    const client = freshClient();
    client.setQueryData(["panel-reviews-admin", 1], { count: 0, next: null, previous: null, results: [] });
    apiFetchMock.mockResolvedValueOnce({ message: "Reseña eliminada" });
    const { result } = renderHook(() => useDeleteReview(), { wrapper });
    result.current.mutate("r1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/reviews/r1/", { method: "DELETE" });
    expect(client.getQueryState(["panel-reviews-admin", 1])?.isInvalidated).toBe(true);
  });

  it("403 conserva el `error` del backend", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, { error: "Solo el autor o un moderador pueden eliminar la reseña" }));
    const { result } = renderHook(() => useDeleteReview(), { wrapper });
    result.current.mutate("r1");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sin_acceso");
    expect(result.current.error?.detail).toBe("Solo el autor o un moderador pueden eliminar la reseña");
  });

  it.each([
    [404, "no_encontrado"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => useDeleteReview(), { wrapper });
    result.current.mutate("r1");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe(kind);
  });
});
