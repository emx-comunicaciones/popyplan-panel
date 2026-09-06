import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildMetricsResponse } from "@/test-utils/fixtures/metrics";
import { toIso } from "@/lib/metrics/period";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { ApiError } from "@/lib/api/client";

import { useEntityHome } from "./useEntityHome";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const TODAY_EVENTS = [
  {
    id: "e1",
    title: "Taller de hoy",
    starts_at: "2026-01-15T18:00:00Z",
    status: "scheduled",
    audience: "anyone",
    community: null,
    organizer: { user_id: 1, public_name: "Titular" },
    capacity: 20,
    registered: 5,
    attended: 0,
    no_show: 0,
  },
];

function routedApiFetch(handlers: {
  events?: unknown;
  reports?: unknown;
  helpRequests?: unknown;
  metrics?: unknown;
  programs?: unknown;
  reportsError?: ApiError;
  helpRequestsError?: ApiError;
}) {
  return (path: string) => {
    if (path.startsWith("/api/panel/entidad/7/events/")) {
      return Promise.resolve(handlers.events ?? TODAY_EVENTS);
    }
    if (path.includes("/api/safety/reports/queue/")) {
      if (handlers.reportsError) return Promise.reject(handlers.reportsError);
      // Array plano de verdad (no `{count, ...}`, docs/SEGURIDAD_Y_MODERACION.md
      // §4): el conteo sale de `.length`, ver el fix de carry-over de W6.
      return Promise.resolve(handlers.reports ?? [{}, {}]);
    }
    if (path.includes("/api/safety/help-requests/pending/")) {
      if (handlers.helpRequestsError) return Promise.reject(handlers.helpRequestsError);
      return Promise.resolve(handlers.helpRequests ?? [{}]);
    }
    if (path === "/api/panel/entidad/7/programs/") {
      return Promise.resolve(handlers.programs ?? []);
    }
    if (path.startsWith("/api/panel/entidad/7/metrics/")) {
      return Promise.resolve(handlers.metrics ?? buildMetricsResponse());
    }
    return Promise.reject(new Error(`ruta inesperada: ${path}`));
  };
}

const TODAY = toIso(new Date());

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("useEntityHome", () => {
  it("compone actividades de hoy, contadores y métricas del mes", async () => {
    apiFetchMock.mockImplementation(routedApiFetch({}));

    const { result } = renderHook(() => useEntityHome(7), { wrapper });

    await waitFor(() => expect(result.current.today.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.pendingReports.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.pendingHelpRequests.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.metrics.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.activePrograms.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/panel/entidad/7/events/?since=${TODAY}&until=${TODAY}`,
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/safety/reports/queue/?organization=7&status=pending",
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/safety/help-requests/pending/?organization=7",
    );
    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/programs/");
    expect(result.current.today.data).toEqual(TODAY_EVENTS);
    expect(result.current.pendingReports.data).toBe(2);
    expect(result.current.pendingHelpRequests.data).toBe(1);
    expect(result.current.metrics.data).toEqual(buildMetricsResponse());
    expect(result.current.activePrograms.data).toEqual([]);
  });

  it("un 403 en reportes/ayuda se traduce en count:null (la tarjeta no es para este rol), no en error", async () => {
    apiFetchMock.mockImplementation(
      routedApiFetch({
        reportsError: new ApiError(403, null),
        helpRequestsError: new ApiError(403, null),
      }),
    );

    const { result } = renderHook(() => useEntityHome(7), { wrapper });

    await waitFor(() => expect(result.current.pendingReports.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.pendingHelpRequests.isSuccess).toBe(true));

    expect(result.current.pendingReports.data).toBeNull();
    expect(result.current.pendingHelpRequests.data).toBeNull();
    expect(result.current.pendingReports.isError).toBe(false);
    expect(result.current.pendingHelpRequests.isError).toBe(false);
  });

  it("un error real (no 403) en los contadores sí queda como isError", async () => {
    apiFetchMock.mockImplementation(
      routedApiFetch({ reportsError: new ApiError(500, null) }),
    );

    const { result } = renderHook(() => useEntityHome(7), { wrapper });

    await waitFor(() => expect(result.current.pendingReports.isError).toBe(true));
  });
});
