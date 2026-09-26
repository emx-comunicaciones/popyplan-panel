/**
 * `PLATFORM_EVENTS.AGENDA`, `EVENTS.LIST` (con `?community=`) y
 * `EVENTS.CANCEL` vistos por la plataforma (admin de plataforma,
 * bloque 3). Las dos listas son paginación estándar de DRF.
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

import {
  PLATFORM_EVENTS_KEY,
  useCancelPlatformEvent,
  useCommunitySearch,
  usePlatformEvents,
} from "./usePlatformEvents";

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

const PAGE = { count: 0, next: null, previous: null, results: [] };

describe("usePlatformEvents", () => {
  it("pide la agenda con from/to y página", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(PAGE);
    const { result } = renderHook(
      () => usePlatformEvents({ kind: "agenda", from: "2026-10-01", to: "2026-10-31" }, 2),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/events/agenda/?page=2&from=2026-10-01&to=2026-10-31");
  });

  it("agenda sin fechas", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(PAGE);
    const { result } = renderHook(() => usePlatformEvents({ kind: "agenda" }, 1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/events/agenda/?page=1");
  });

  it("por comunidad pide /api/events/?community=", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(PAGE);
    const { result } = renderHook(() => usePlatformEvents({ kind: "community", communityId: "c-1" }, 1), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/events/?page=1&community=c-1");
  });

  it.each([
    [400, "invalido"],
    [403, "sin_acceso"],
    [404, "no_encontrado"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, { detail: "x" }));
    const { result } = renderHook(() => usePlatformEvents({ kind: "agenda" }, 1), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe(kind);
  });

  it("400 sin detail cae al mensaje propio", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));
    const { result } = renderHook(() => usePlatformEvents({ kind: "agenda" }, 1), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.detail).toBeUndefined();
    expect(result.current.error?.message).toBe("Revisa los filtros.");
  });
});

describe("useCommunitySearch", () => {
  it("con menos de dos caracteres no pide nada", () => {
    freshClient();
    const { result } = renderHook(() => useCommunitySearch("y"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("busca y devuelve las filas", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [{ id: "c1", name: "Yoga" }] });
    const { result } = renderHook(() => useCommunitySearch(" yo ga "), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/?search=yo%20ga");
    expect(result.current.data).toEqual([{ id: "c1", name: "Yoga" }]);
  });

  it("un fallo es desconocido", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, null));
    const { result } = renderHook(() => useCommunitySearch("yoga"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});

describe("useCancelPlatformEvent", () => {
  it("cancela e invalida el listado y el detalle", async () => {
    freshClient();
    queryClient.setQueryData([PLATFORM_EVENTS_KEY, "x"], PAGE);
    queryClient.setQueryData(["panel-event", "e-1"], { id: "e-1" });
    apiFetchMock.mockResolvedValueOnce({ id: "e-1", status: "cancelled" });
    const { result } = renderHook(() => useCancelPlatformEvent(), { wrapper });
    result.current.mutate("e-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/events/e-1/cancel/", { method: "POST" });
    expect(queryClient.getQueryState([PLATFORM_EVENTS_KEY, "x"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["panel-event", "e-1"])?.isInvalidated).toBe(true);
  });

  it.each([
    [403, "sin_acceso"],
    [404, "no_encontrado"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => useCancelPlatformEvent(), { wrapper });
    result.current.mutate("e-1");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe(kind);
  });
});
