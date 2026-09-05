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
import { buildEntityCommunityRow } from "@/test-utils/fixtures/community";

import { ToggleCrossSpaceError, useToggleCrossSpace } from "./useToggleCrossSpace";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useToggleCrossSpace", () => {
  it("manda PATCH /api/communities/{id}/ con allow_cross_space", async () => {
    const community = buildEntityCommunityRow({ space: "families", allow_cross_space: true });
    apiFetchMock.mockResolvedValueOnce(community);

    const { result } = renderHook(() => useToggleCrossSpace(), { wrapper });
    result.current.mutate({ orgId: 7, communityId: "c-1", allowCrossSpace: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/c-1/", {
      method: "PATCH",
      body: { allow_cross_space: true },
    });
  });

  it("403 surge como ToggleCrossSpaceError con el mensaje de permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, { detail: "sin permiso" }));

    const { result } = renderHook(() => useToggleCrossSpace(), { wrapper });
    result.current.mutate({ orgId: 7, communityId: "c-1", allowCrossSpace: false });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ToggleCrossSpaceError);
    expect(result.current.error?.message).toMatch(/titular o moderador/);
  });

  it("cualquier otro fallo surge como ToggleCrossSpaceError genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useToggleCrossSpace(), { wrapper });
    result.current.mutate({ orgId: 7, communityId: "c-1", allowCrossSpace: false });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ToggleCrossSpaceError);
  });
});
