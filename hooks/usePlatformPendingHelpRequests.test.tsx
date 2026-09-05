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

import { usePlatformPendingHelpRequests } from "./usePlatformPendingHelpRequests";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const ORGS_PAGE = {
  count: 2,
  next: null,
  previous: null,
  results: [
    { id: 1, name: "Ayto", slug: "ayto", org_type: "administracion", is_verified: true },
    { id: 2, name: "Asoc", slug: "asoc", org_type: "asociacion", is_verified: true },
  ],
};

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
  it("recorre las entidades y agrega los avisos pendientes, tolerando 403 por entidad", async () => {
    apiFetchMock
      .mockResolvedValueOnce(ORGS_PAGE) // organizations page 1
      .mockResolvedValueOnce([HR]) // pending org 1
      .mockRejectedValueOnce(new ApiError(403, null)); // pending org 2: sin acceso

    const { result } = renderHook(() => usePlatformPendingHelpRequests(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([HR]);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/?page=1");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/help-requests/pending/?organization=1");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/help-requests/pending/?organization=2");
  });

  it("ordena los avisos de varias entidades por fecha, más reciente primero", async () => {
    const older = { ...HR, id: 10, created_at: "2026-09-01T09:00:00Z" };
    const newer = { ...HR, id: 11, created_at: "2026-09-02T09:00:00Z" };
    apiFetchMock
      .mockResolvedValueOnce(ORGS_PAGE)
      .mockResolvedValueOnce([older])
      .mockResolvedValueOnce([newer]);

    const { result } = renderHook(() => usePlatformPendingHelpRequests(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([newer, older]);
  });

  it("lista vacía si nadie es guardia/titular/moderador de ninguna entidad", async () => {
    apiFetchMock
      .mockResolvedValueOnce(ORGS_PAGE)
      .mockRejectedValueOnce(new ApiError(403, null))
      .mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => usePlatformPendingHelpRequests(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it("un fallo al listar entidades sí es un error de página", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));

    const { result } = renderHook(() => usePlatformPendingHelpRequests(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
