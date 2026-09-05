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
});
