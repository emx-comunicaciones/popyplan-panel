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

import { AuditLogError, useAuditLog } from "./useAuditLog";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PAGE = { count: 0, next: null, previous: null, results: [] };

describe("useAuditLog", () => {
  it("pide sin filtros", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);
    const { result } = renderHook(() => useAuditLog(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/audit/?");
  });

  it("añade todos los filtros documentados", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);
    const { result } = renderHook(
      () =>
        useAuditLog({
          actor: 3,
          action: "organization.created",
          target_type: "entities.organization",
          target_id: "5",
          since: "2026-01-01",
          until: "2026-02-01",
          page: 2,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/safety/audit/?actor=3&action=organization.created&target_type=entities.organization&target_id=5&since=2026-01-01&until=2026-02-01&page=2",
    );
  });

  it("403 surge como sin_acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useAuditLog(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as AuditLogError).kind).toBe("sin_acceso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => useAuditLog(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as AuditLogError).kind).toBe("desconocido");
  });
});
