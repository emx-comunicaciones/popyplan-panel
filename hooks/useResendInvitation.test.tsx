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

import { ResendInvitationError, useResendInvitation } from "./useResendInvitation";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const INVITATION = {
  id: 3,
  organization: 7,
  email: "ana@example.com",
  display_name: "Ana",
  community: null,
  referent: null,
  status: "pending" as const,
  sent_at: "2026-09-05T10:00:00Z",
  accepted_at: null,
  invited_by: 1,
  created_at: "2026-09-05T10:00:00Z",
};

describe("useResendInvitation", () => {
  it("llama a POST .../invitations/{iid}/resend/", async () => {
    apiFetchMock.mockResolvedValueOnce(INVITATION);

    const { result } = renderHook(() => useResendInvitation(7), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/invitations/3/resend/", {
      method: "POST",
    });
  });

  it("400 (ya no pending) surge como invalido", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useResendInvitation(7), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ResendInvitationError).kind).toBe("invalido");
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useResendInvitation(7), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ResendInvitationError).kind).toBe("sin_permiso");
  });

  it("404 surge como no_encontrada", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));

    const { result } = renderHook(() => useResendInvitation(7), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ResendInvitationError).kind).toBe("no_encontrada");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useResendInvitation(7), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ResendInvitationError).kind).toBe("desconocido");
  });
});
