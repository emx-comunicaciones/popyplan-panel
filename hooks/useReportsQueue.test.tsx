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

// Array plano de verdad (no `{count, ...}`, docs/SEGURIDAD_Y_MODERACION.md §4).
const PAGE: unknown[] = [];

describe("useReportsQueue", () => {
  it("pide organization sin más filtros", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);

    const { result } = renderHook(() => useReportsQueue(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/reports/queue/?organization=7");
  });

  it("añade status", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);

    const { result } = renderHook(() => useReportsQueue(7, { status: "pending" }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/safety/reports/queue/?organization=7&status=pending",
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

  it("«all» pide los tres estados y los junta por fecha, también los resueltos (error 11)", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.endsWith("status=pending")) return [{ id: 1, status: "pending", created_at: "2026-09-01T10:00:00Z" }];
      if (path.endsWith("status=in_review")) return [{ id: 2, status: "in_review", created_at: "2026-09-03T10:00:00Z" }];
      if (path.endsWith("status=resolved")) return [{ id: 3, status: "resolved", created_at: "2026-09-02T10:00:00Z" }];
      throw new Error(`sin mock para ${path}`);
    });

    const { result } = renderHook(() => useReportsQueue(7, { status: "all" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((report) => report.id)).toEqual([2, 3, 1]);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/reports/queue/?organization=7&status=resolved");
  });

  it("«all» con un 403 en cualquiera de las tres surge como sin_acceso", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, null));

    const { result } = renderHook(() => useReportsQueue(7, { status: "all" }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as ReportsQueueError).kind).toBe("sin_acceso");
  });
});
