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

import { useUserSearch } from "./useUserSearch";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useUserSearch", () => {
  it("no busca con menos de dos caracteres", () => {
    const { result } = renderHook(() => useUserSearch("a"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("busca y devuelve los resultados", async () => {
    apiFetchMock.mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [{ id: 1, username: "ana", email: "ana@example.com" }],
    });
    const { result } = renderHook(() => useUserSearch("ana"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 1, username: "ana", email: "ana@example.com" }]);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/users/?search=ana");
  });

  it("un 403 (sin is_staff) cae a lista vacía en vez de romper el formulario", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useUserSearch("ana"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("un fallo que no es de la API se relanza tal cual", async () => {
    const boom = new Error("caído");
    apiFetchMock.mockRejectedValueOnce(boom);
    const { result } = renderHook(() => useUserSearch("ana"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
  });
});
