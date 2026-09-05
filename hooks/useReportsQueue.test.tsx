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

import { ReportsQueueError, useReportsQueue } from "./useReportsQueue";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PAGE = { count: 0, next: null, previous: null, results: [] };

describe("useReportsQueue", () => {
  it("pide organization sin más filtros", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);

    const { result } = renderHook(() => useReportsQueue(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/reports/queue/?organization=7");
  });

  it("añade status y page", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);

    const { result } = renderHook(() => useReportsQueue(7, { status: "pending", page: 2 }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/safety/reports/queue/?organization=7&status=pending&page=2",
    );
  });

  it("403 surge como sin_acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useReportsQueue(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ReportsQueueError);
    expect((result.current.error as ReportsQueueError).kind).toBe("sin_acceso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useReportsQueue(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as ReportsQueueError).kind).toBe("desconocido");
  });

  it("sin orgId pide la cola de plataforma, sin `organization`", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);

    const { result } = renderHook(() => useReportsQueue(undefined, { status: "pending" }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/reports/queue/?status=pending");
  });
});
