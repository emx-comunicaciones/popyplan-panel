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
  AcknowledgeHelpRequestGlobalError,
  useAcknowledgeHelpRequestGlobal,
} from "./useAcknowledgeHelpRequestGlobal";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useAcknowledgeHelpRequestGlobal", () => {
  it("marca el aviso como atendido", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 1 });
    const { result } = renderHook(() => useAcknowledgeHelpRequestGlobal(), { wrapper });
    result.current.mutate("1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/safety/help-requests/1/acknowledge/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("403 sin permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useAcknowledgeHelpRequestGlobal(), { wrapper });
    result.current.mutate("1");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(AcknowledgeHelpRequestGlobalError);
  });

  it("cualquier otro fallo", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => useAcknowledgeHelpRequestGlobal(), { wrapper });
    result.current.mutate("1");
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("invalida tanto la lista global como la de entidad", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 1 });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const entityKey = ["panel-help-requests-pending", 7];
    const platformKey = ["panel-platform-help-requests-pending"];
    queryClient.setQueryData(entityKey, []);
    queryClient.setQueryData(platformKey, []);
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAcknowledgeHelpRequestGlobal(), { wrapper: clientWrapper });
    result.current.mutate("1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(queryClient.getQueryState(platformKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(entityKey)?.isInvalidated).toBe(true);
    });
  });
});

describe("useAcknowledgeHelpRequestGlobal (contadores de Inicio)", () => {
  it("refresca el contador de Inicio de cualquier entidad y las estadísticas de plataforma", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 1 });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Desde plataforma no se sabe de qué entidad es el aviso: la familia
    // de contadores de Inicio se invalida entera por prefijo.
    const homeKey = ["panel-home-pending-help-requests", 7];
    const statsKey = ["panel-dashboard-stats"];
    queryClient.setQueryData(homeKey, 3);
    queryClient.setQueryData(statsKey, { pending_help_requests: 3 });
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAcknowledgeHelpRequestGlobal(), { wrapper: clientWrapper });
    result.current.mutate("1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(queryClient.getQueryState(homeKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(statsKey)?.isInvalidated).toBe(true);
    });
  });
});
