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
import { buildReportDetail } from "@/test-utils/fixtures/report";

import { ReportError, useReport } from "./useReport";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useReport", () => {
  it("pide el detalle del reporte", async () => {
    const detail = buildReportDetail();
    apiFetchMock.mockResolvedValueOnce(detail);

    const { result } = renderHook(() => useReport("r1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/reports/r1/");
    expect(result.current.data).toEqual(detail);
  });

  it("403 surge como sin_acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useReport("r1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as ReportError).kind).toBe("sin_acceso");
  });

  it("404 surge como no_encontrado", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));

    const { result } = renderHook(() => useReport("r1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as ReportError).kind).toBe("no_encontrado");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useReport("r1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as ReportError).kind).toBe("desconocido");
  });

  it("sin reportId no dispara la petición", () => {
    const { result } = renderHook(() => useReport(""), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
