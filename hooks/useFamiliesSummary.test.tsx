import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { buildFamiliesSummary } from "@/test-utils/fixtures/families";

import { FamiliesSummaryError, useFamiliesSummary } from "./useFamiliesSummary";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useFamiliesSummary", () => {
  it("pide GET /api/panel/entidad/{orgId}/families/ y devuelve el resumen", async () => {
    const summary = buildFamiliesSummary();
    apiFetchMock.mockResolvedValueOnce(summary);

    const { result } = renderHook(() => useFamiliesSummary(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/families/");
    expect(result.current.data).toEqual(summary);
  });

  it("acepta members_count suprimido (null + suppressed: true) sin romper el tipo", async () => {
    const summary = buildFamiliesSummary({
      members_count: null,
      suppressed: true,
      communities: [
        {
          id: "c-1",
          name: "Familias",
          members_count: null,
          allow_cross_space: false,
          suppressed: true,
        },
      ],
    });
    apiFetchMock.mockResolvedValueOnce(summary);

    const { result } = renderHook(() => useFamiliesSummary(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.members_count).toBeNull();
    expect(result.current.data?.communities[0].suppressed).toBe(true);
  });

  it("sin comunidades de familias, las cinco claves vuelven vacías (200, nunca 404)", async () => {
    const summary = buildFamiliesSummary({
      communities: [],
      members_count: 0,
      upcoming_events: [],
      announcements: [],
      resources: [],
    });
    apiFetchMock.mockResolvedValueOnce(summary);

    const { result } = renderHook(() => useFamiliesSummary(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(summary);
  });

  it("pasa tal cual los contadores de la red de apoyo (§14.5, ya tipados como SuppressibleCount)", async () => {
    const summary = buildFamiliesSummary({
      people_with_support_network: { value: null, suppressed: true },
      active_supporters: { value: 9, suppressed: false },
      supporters_notified_on_help: { value: 6, suppressed: false },
      missing_families_space_supporters: 2,
    });
    apiFetchMock.mockResolvedValueOnce(summary);

    const { result } = renderHook(() => useFamiliesSummary(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.people_with_support_network).toEqual({
      value: null,
      suppressed: true,
    });
    expect(result.current.data?.active_supporters).toEqual({ value: 9, suppressed: false });
    expect(result.current.data?.supporters_notified_on_help).toEqual({
      value: 6,
      suppressed: false,
    });
    expect(result.current.data?.missing_families_space_supporters).toBe(2);
  });

  it("cualquier fallo surge como FamiliesSummaryError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useFamiliesSummary(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(FamiliesSummaryError);
  });
});
