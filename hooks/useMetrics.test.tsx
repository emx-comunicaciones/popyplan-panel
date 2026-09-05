import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildMetricsResponse } from "@/test-utils/fixtures/metrics";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { ApiError } from "@/lib/api/client";

import { MetricsError, useMetrics } from "./useMetrics";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PERIOD = { since: "2026-01-01", until: "2026-01-31" };

describe("useMetrics", () => {
  it("entidad: pide la ruta y la query string exactas (since/until/group_by)", async () => {
    const response = buildMetricsResponse();
    apiFetchMock.mockResolvedValueOnce(response);

    const { result } = renderHook(() => useMetrics("entidad", 7, PERIOD, "place"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/entidad/7/metrics/?since=2026-01-01&until=2026-01-31&group_by=place",
    );
    expect(result.current.data).toEqual(response);
  });

  it("paraguas: usa la ruta de paraguas con el orgId dado", async () => {
    apiFetchMock.mockResolvedValueOnce(buildMetricsResponse());

    const { result } = renderHook(() => useMetrics("paraguas", 3, PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/paraguas/3/metrics/?since=2026-01-01&until=2026-01-31",
    );
  });

  it("plataforma: no lleva orgId en la ruta", async () => {
    apiFetchMock.mockResolvedValueOnce(buildMetricsResponse());

    const { result } = renderHook(() => useMetrics("plataforma", undefined, PERIOD, "month"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/plataforma/metrics/?since=2026-01-01&until=2026-01-31&group_by=month",
    );
  });

  it("un 400 del backend (periodo inválido) surge como MetricsError con kind 'periodo_invalido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "periodo inválido" }));

    const { result } = renderHook(() => useMetrics("entidad", 7, PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(MetricsError);
    expect((result.current.error as MetricsError).kind).toBe("periodo_invalido");
  });

  it("un 403 surge como MetricsError con kind 'sin_acceso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useMetrics("paraguas", 3, PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as MetricsError).kind).toBe("sin_acceso");
  });

  it("cualquier otro error surge como MetricsError con kind 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useMetrics("entidad", 7, PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as MetricsError).kind).toBe("desconocido");
  });

  it("entidad sin orgId lanza (error de programación, nunca debería llegar sin él)", () => {
    expect(() => renderHook(() => useMetrics("entidad", undefined, PERIOD), { wrapper })).toThrow(
      "falta orgId para el ámbito 'entidad'",
    );
  });

  it("paraguas sin orgId lanza (error de programación, nunca debería llegar sin él)", () => {
    expect(() => renderHook(() => useMetrics("paraguas", undefined, PERIOD), { wrapper })).toThrow(
      "falta orgId para el ámbito 'paraguas'",
    );
  });
});
