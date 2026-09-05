import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { usePlatformPendingHelpRequests } from "./usePlatformPendingHelpRequests";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const HR = {
  id: 1,
  user: 1,
  community: null,
  organization: 1,
  user_display: { id: 1, public_name: "Ana", photo: null },
  community_display: null,
  event_display: null,
  organization_display: { id: 1, name: "Ayto" },
  acknowledged_by: null,
  acknowledged_at: null,
  created_at: "2026-09-01T10:00:00Z",
};

describe("usePlatformPendingHelpRequests", () => {
  it("pide el agregado de plataforma (sin `organization`) en una sola llamada", async () => {
    apiFetchMock.mockResolvedValueOnce([HR]);

    const { result } = renderHook(() => usePlatformPendingHelpRequests(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([HR]);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/help-requests/pending/");
  });

  it("ordena los avisos por fecha, más reciente primero", async () => {
    const older = { ...HR, id: 10, created_at: "2026-09-01T09:00:00Z" };
    const newer = { ...HR, id: 11, created_at: "2026-09-02T09:00:00Z" };
    apiFetchMock.mockResolvedValueOnce([older, newer]);

    const { result } = renderHook(() => usePlatformPendingHelpRequests(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([newer, older]);
  });

  it("lista vacía si no hay avisos pendientes en ninguna entidad", async () => {
    apiFetchMock.mockResolvedValueOnce([]);

    const { result } = renderHook(() => usePlatformPendingHelpRequests(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it("un fallo de la petición es un error de página", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));

    const { result } = renderHook(() => usePlatformPendingHelpRequests(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
