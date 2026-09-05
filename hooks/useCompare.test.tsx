import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCompareResponse } from "@/test-utils/fixtures/metrics";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { ApiError } from "@/lib/api/client";

import { CompareError, useCompare } from "./useCompare";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PERIOD = { since: "2026-04-01", until: "2026-06-30" };

describe("useCompare", () => {
  it("paraguas: pide la ruta y la query string exactas (since/until/group_by obligatorio)", async () => {
    const response = buildCompareResponse();
    apiFetchMock.mockResolvedValueOnce(response);

    const { result } = renderHook(() => useCompare("paraguas", 3, PERIOD, "comarca"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/paraguas/3/compare/?since=2026-04-01&until=2026-06-30&group_by=comarca",
    );
    expect(result.current.data).toEqual(response);
  });

  it("plataforma: no lleva orgId en la ruta", async () => {
    apiFetchMock.mockResolvedValueOnce(buildCompareResponse({ group_by: "province" }));

    const { result } = renderHook(() => useCompare("plataforma", undefined, PERIOD, "province"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/plataforma/compare/?since=2026-04-01&until=2026-06-30&group_by=province",
    );
  });

  it("un 400 del backend (periodo o group_by inválidos) surge como CompareError con kind 'periodo_invalido'", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { group_by: "Desglose obligatorio: comarca, organization o place." }),
    );

    const { result } = renderHook(() => useCompare("paraguas", 3, PERIOD, "comarca"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(CompareError);
    expect((result.current.error as CompareError).kind).toBe("periodo_invalido");
  });

  it("un 403 surge como CompareError con kind 'sin_acceso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useCompare("plataforma", undefined, PERIOD, "organization"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as CompareError).kind).toBe("sin_acceso");
  });

  it("cualquier otro error surge como CompareError con kind 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCompare("paraguas", 3, PERIOD, "place"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as CompareError).kind).toBe("desconocido");
  });

  it("paraguas sin orgId lanza (error de programación, nunca debería llegar sin él)", () => {
    expect(() =>
      renderHook(() => useCompare("paraguas", undefined, PERIOD, "comarca"), { wrapper }),
    ).toThrow("falta orgId para el ámbito 'paraguas'");
  });
});
