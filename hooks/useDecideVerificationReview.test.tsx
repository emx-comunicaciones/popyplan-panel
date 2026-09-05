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

import { DecideVerificationReviewError, useDecideVerificationReview } from "./useDecideVerificationReview";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useDecideVerificationReview", () => {
  it("aprueba con nota", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: "r1", status: "approved" });
    const { result } = renderHook(() => useDecideVerificationReview(), { wrapper });
    result.current.mutate({ reviewId: "r1", approved: true, note: "ok" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/users/verification/reviews/r1/decide/",
      expect.objectContaining({ method: "POST", body: { approved: true, note: "ok" } }),
    );
  });

  it("rechaza sin nota (nota vacía por defecto)", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: "r1", status: "rejected" });
    const { result } = renderHook(() => useDecideVerificationReview(), { wrapper });
    result.current.mutate({ reviewId: "r1", approved: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/users/verification/reviews/r1/decide/",
      expect.objectContaining({ body: { approved: false, note: "" } }),
    );
  });

  it("403 sin permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useDecideVerificationReview(), { wrapper });
    result.current.mutate({ reviewId: "r1", approved: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(DecideVerificationReviewError);
  });

  it("cualquier otro fallo", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => useDecideVerificationReview(), { wrapper });
    result.current.mutate({ reviewId: "r1", approved: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
