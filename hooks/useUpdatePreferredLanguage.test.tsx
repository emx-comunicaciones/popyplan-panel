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
import { USERS } from "@/lib/api/endpoints";

import { useUpdatePreferredLanguage } from "./useUpdatePreferredLanguage";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useUpdatePreferredLanguage", () => {
  it(`manda PATCH ${USERS.UPDATE_PROFILE} con preferred_language`, async () => {
    apiFetchMock.mockResolvedValueOnce({ preferred_language: "eu" });

    const { result } = renderHook(() => useUpdatePreferredLanguage(), { wrapper });
    result.current.mutate("eu");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(USERS.UPDATE_PROFILE, {
      method: "PATCH",
      body: { preferred_language: "eu" },
    });
    expect(result.current.data).toEqual({ preferred_language: "eu" });
  });

  it("un 400 (backend sin el campo desplegado) se tolera: resuelve null, no lanza", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { preferred_language: ["no soportado"] }));

    const { result } = renderHook(() => useUpdatePreferredLanguage(), { wrapper });
    result.current.mutate("ca");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("un 401 (sin sesión real) también se tolera", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(401, null));

    const { result } = renderHook(() => useUpdatePreferredLanguage(), { wrapper });
    result.current.mutate("es");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("un fallo que no es ApiError (p. ej. red caída) sí surge como error de la mutación", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useUpdatePreferredLanguage(), { wrapper });
    result.current.mutate("eu");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
