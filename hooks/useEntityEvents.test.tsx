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

import { EntityEventsError, useEntityEvents } from "./useEntityEvents";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PERIOD = { since: "2026-01-01", until: "2026-01-31" };

describe("useEntityEvents", () => {
  it("pide since/until sin status", async () => {
    apiFetchMock.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useEntityEvents(7, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/entidad/7/events/?since=2026-01-01&until=2026-01-31",
    );
  });

  it("añade status cuando se pasa", async () => {
    apiFetchMock.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useEntityEvents(7, PERIOD, "scheduled"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/entidad/7/events/?since=2026-01-01&until=2026-01-31&status=scheduled",
    );
  });

  it("un 400 surge como 'periodo_invalido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useEntityEvents(7, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(EntityEventsError);
    expect((result.current.error as EntityEventsError).kind).toBe("periodo_invalido");
  });

  it("un 403 surge como 'sin_acceso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useEntityEvents(7, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as EntityEventsError).kind).toBe("sin_acceso");
  });

  it("cualquier otro error surge como 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useEntityEvents(7, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as EntityEventsError).kind).toBe("desconocido");
  });
});
