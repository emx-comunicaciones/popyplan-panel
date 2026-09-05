import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { buildCommunityMember } from "@/test-utils/fixtures/community";

import { CommunityMembersError, useCommunityMembers, useCommunityPendingRequests } from "./useCommunityMembers";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCommunityMembers", () => {
  it("pide los miembros activos de la comunidad", async () => {
    const member = buildCommunityMember();
    apiFetchMock.mockResolvedValueOnce([member]);

    const { result } = renderHook(() => useCommunityMembers("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/c1/members/");
    expect(result.current.data).toEqual([member]);
  });

  it("sin communityId no dispara la petición", () => {
    const { result } = renderHook(() => useCommunityMembers(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("cualquier fallo surge como CommunityMembersError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCommunityMembers("c1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(CommunityMembersError);
  });
});

describe("useCommunityPendingRequests", () => {
  it("pide las solicitudes pendientes", async () => {
    const pending = buildCommunityMember({ status: "pending" });
    apiFetchMock.mockResolvedValueOnce([pending]);

    const { result } = renderHook(() => useCommunityPendingRequests("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/c1/pending-requests/");
    expect(result.current.data).toEqual([pending]);
  });

  it("sin communityId no dispara la petición", () => {
    const { result } = renderHook(() => useCommunityPendingRequests(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("cualquier fallo surge como CommunityMembersError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCommunityPendingRequests("c1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(CommunityMembersError);
  });
});
