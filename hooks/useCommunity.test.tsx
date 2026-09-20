import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { buildCommunityDetail } from "@/test-utils/fixtures/community";

import { CommunityError, useCommunity } from "./useCommunity";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCommunity", () => {
  it("pide la ficha completa de la comunidad", async () => {
    const community = buildCommunityDetail();
    apiFetchMock.mockResolvedValueOnce(community);

    const { result } = renderHook(() => useCommunity("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/c1/");
    expect(result.current.data).toEqual(community);
  });

  it("cualquier fallo surge como CommunityError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCommunity("c1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(CommunityError);
  });

  it("con enabled:false no pide nada", () => {
    const { result } = renderHook(() => useCommunity("c1", { enabled: false }), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });
});
