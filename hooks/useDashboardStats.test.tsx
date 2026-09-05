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

import { useDashboardStats } from "./useDashboardStats";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const STATS = {
  totals: { users: 10, events: 2, chats: 0, communities: 1 },
  users: { active: 8, blocked: 0, verified: 5, new_today: 1, new_week: 2, growth_pct: 10 },
  events: { scheduled: 3, growth_pct: 0, by_audience: [] },
  reports: { pending: 1 },
  help_requests: { pending: 2 },
  registrations_weekly: [],
};

describe("useDashboardStats", () => {
  it("devuelve las estadísticas", async () => {
    apiFetchMock.mockResolvedValueOnce(STATS);
    const { result } = renderHook(() => useDashboardStats(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(STATS);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/dashboard-stats/");
  });

  it("403 (sin is_staff) devuelve null, no un error", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useDashboardStats(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("cualquier otro fallo sí es un error", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => useDashboardStats(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
