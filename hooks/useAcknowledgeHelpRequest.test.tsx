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
import { buildHelpRequest } from "@/test-utils/fixtures/helpRequest";

import { AcknowledgeHelpRequestError, useAcknowledgeHelpRequest } from "./useAcknowledgeHelpRequest";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useAcknowledgeHelpRequest", () => {
  it("marca el aviso como atendido", async () => {
    const acknowledged = buildHelpRequest({ acknowledged_by: 9, acknowledged_at: "2026-09-01T18:35:00Z" });
    apiFetchMock.mockResolvedValueOnce(acknowledged);

    const { result } = renderHook(() => useAcknowledgeHelpRequest(7), { wrapper });
    result.current.mutate("hr-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/help-requests/hr-1/acknowledge/", {
      method: "POST",
    });
    expect(result.current.data).toEqual(acknowledged);
  });

  it("403 lanza un mensaje de permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useAcknowledgeHelpRequest(7), { wrapper });
    result.current.mutate("hr-1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(AcknowledgeHelpRequestError);
    expect(result.current.error?.message).toBe("No tienes permiso para atender este aviso.");
  });

  it("cualquier otro fallo muestra el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useAcknowledgeHelpRequest(7), { wrapper });
    result.current.mutate("hr-1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo marcar el aviso como atendido.");
  });

  it("invalida tanto la lista de la entidad como la global de plataforma", async () => {
    apiFetchMock.mockResolvedValueOnce(buildHelpRequest({ acknowledged_by: 9 }));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const entityKey = ["panel-help-requests-pending", 7];
    const platformKey = ["panel-platform-help-requests-pending"];
    queryClient.setQueryData(entityKey, []);
    queryClient.setQueryData(platformKey, []);
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAcknowledgeHelpRequest(7), { wrapper: clientWrapper });
    result.current.mutate("hr-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(queryClient.getQueryState(entityKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(platformKey)?.isInvalidated).toBe(true);
    });
  });
});

describe("useAcknowledgeHelpRequest (contadores de Inicio)", () => {
  it("refresca el contador del Inicio de la entidad y las estadísticas de plataforma", async () => {
    apiFetchMock.mockResolvedValueOnce(buildHelpRequest({ acknowledged_by: 9 }));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // `useEntityHome` cuenta los avisos pendientes con su propia clave, y
    // `useDashboardStats` los agrega para el Inicio de plataforma: sin
    // invalidarlas, «He contactado» dejaba las dos tarjetas con el número
    // de antes hasta recargar la página.
    const homeKey = ["panel-home-pending-help-requests", 7];
    const statsKey = ["panel-dashboard-stats"];
    queryClient.setQueryData(homeKey, 3);
    queryClient.setQueryData(statsKey, { pending_help_requests: 3 });
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAcknowledgeHelpRequest(7), { wrapper: clientWrapper });
    result.current.mutate("hr-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(queryClient.getQueryState(homeKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(statsKey)?.isInvalidated).toBe(true);
    });
  });
});
