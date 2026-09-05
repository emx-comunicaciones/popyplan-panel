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

import { InvitationsError, useInvitations } from "./useInvitations";

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

describe("useInvitations", () => {
  it("sin status, pide la ruta sin query", async () => {
    apiFetchMock.mockResolvedValueOnce([INVITATION]);

    const { result } = renderHook(() => useInvitations(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/invitations/");
    expect(result.current.data).toEqual([INVITATION]);
  });

  it("con status, añade ?status=pending", async () => {
    apiFetchMock.mockResolvedValueOnce([INVITATION]);

    const { result } = renderHook(() => useInvitations(7, "pending"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/invitations/?status=pending");
  });

  it("403 surge como InvitationsError con mensaje de permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useInvitations(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(InvitationsError);
    expect(result.current.error?.message).toBe("No tienes permiso para ver las invitaciones.");
  });

  it("cualquier otro fallo surge con mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useInvitations(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("No se pudieron cargar las invitaciones.");
  });
});
