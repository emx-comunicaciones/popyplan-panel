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
import { TRACKING } from "@/lib/api/endpoints";
import { buildSharedTracking } from "@/test-utils/fixtures/tracking";

import { ProposeGoalError, SharedTrackingError, useProposeGoal, useSharedTracking } from "./useSharedTracking";

afterEach(() => {
  apiFetchMock.mockReset();
});

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
}

describe("useSharedTracking", () => {
  it("pide TRACKING.SHARED y devuelve lo compartido", async () => {
    const data = buildSharedTracking();
    apiFetchMock.mockResolvedValueOnce(data);
    const { wrapper } = setup();

    const { result } = renderHook(() => useSharedTracking(96, "13", true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(TRACKING.SHARED(96, "13"));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/96/program/people/13/shared/");
    expect(result.current.data).toEqual(data);
  });

  it("no pide nada (ni deja rastro en AuditLog) con enabled=false", () => {
    const { wrapper } = setup();
    renderHook(() => useSharedTracking(96, "13", false), { wrapper });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it.each([403, 404])("un %i es 'sin_acceso'", async (status) => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { wrapper } = setup();

    const { result } = renderHook(() => useSharedTracking(96, 13, true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(SharedTrackingError);
    expect(result.current.error?.kind).toBe("sin_acceso");
  });

  it("un 500 con detail es 'desconocido' con el texto del backend; sin él, el mensaje propio", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, { detail: "Algo se rompió." }));
    const first = setup();
    const a = renderHook(() => useSharedTracking(96, 13, true), { wrapper: first.wrapper });
    await waitFor(() => expect(a.result.current.isError).toBe(true));
    expect(a.result.current.error?.kind).toBe("desconocido");
    expect(a.result.current.error?.detail).toBe("Algo se rompió.");

    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    const second = setup();
    const b = renderHook(() => useSharedTracking(96, 13, true), { wrapper: second.wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
    expect(b.result.current.error?.message).toBe("No se pudo cargar el seguimiento compartido.");
    expect(b.result.current.error?.detail).toBeUndefined();
  });
});

describe("useProposeGoal", () => {
  it("manda POST a TRACKING.PROPOSE_GOAL e invalida lo compartido", async () => {
    apiFetchMock.mockResolvedValueOnce(buildSharedTracking());
    const { queryClient, wrapper } = setup();
    const shared = renderHook(() => useSharedTracking("96", "13", true), { wrapper });
    await waitFor(() => expect(shared.result.current.isSuccess).toBe(true));

    apiFetchMock.mockResolvedValueOnce({ id: 5, week_start: "2026-09-21", title: "Caminar" });
    const { result } = renderHook(() => useProposeGoal(96, 13), { wrapper });
    result.current.mutate({ title: "Caminar" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/96/program/people/13/goals/", {
      method: "POST",
      body: { title: "Caminar" },
    });
    expect(TRACKING.PROPOSE_GOAL(96, 13)).toBe("/api/panel/entidad/96/program/people/13/goals/");
    expect(queryClient.getQueryState(["panel-program-shared", "96", "13"])?.isInvalidated).toBe(true);
  });

  it("traduce 400 (literal), 400 sin cuerpo, 404 y un fallo de red", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useProposeGoal(96, 13), { wrapper });

    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { title: ["Máximo 10 objetivos por semana."] }));
    result.current.mutate({ title: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ProposeGoalError);
    expect(result.current.error?.kind).toBe("invalido");
    expect(result.current.error?.detail).toBe("Máximo 10 objetivos por semana.");

    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));
    result.current.mutate({ title: "x" });
    await waitFor(() => expect(result.current.error?.message).toBe("Revisa el objetivo: no es válido."));

    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));
    result.current.mutate({ title: "x" });
    await waitFor(() => expect(result.current.error?.kind).toBe("sin_acceso"));

    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    result.current.mutate({ title: "x" });
    await waitFor(() => expect(result.current.error?.kind).toBe("desconocido"));
  });
});
