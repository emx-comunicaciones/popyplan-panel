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
import { buildHelpRequest } from "@/test-utils/fixtures/helpRequest";

import { PendingHelpRequestsError, usePendingHelpRequests } from "./usePendingHelpRequests";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("usePendingHelpRequests", () => {
  it("pide los avisos pendientes de la entidad", async () => {
    const row = buildHelpRequest();
    apiFetchMock.mockResolvedValueOnce([row]);

    const { result } = renderHook(() => usePendingHelpRequests(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/help-requests/pending/?organization=7");
    expect(result.current.data).toEqual([row]);
  });

  it("403 (sin guardia asignada) surge como sin_acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => usePendingHelpRequests(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as PendingHelpRequestsError).kind).toBe("sin_acceso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => usePendingHelpRequests(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as PendingHelpRequestsError).kind).toBe("desconocido");
  });
});
