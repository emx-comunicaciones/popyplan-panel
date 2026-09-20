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
import { COMMUNITIES } from "@/lib/api/endpoints";

import { CommunityInviteCodeError, useCommunityInviteCode } from "./useCommunityInviteCode";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCommunityInviteCode", () => {
  it("pide el código de invitación de la comunidad y devuelve solo el código", async () => {
    apiFetchMock.mockResolvedValueOnce({ invite_code: "9f2c-1111" });

    const { result } = renderHook(() => useCommunityInviteCode("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(COMMUNITIES.INVITE_CODE("c1")).toBe("/api/communities/c1/invite-code/");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/c1/invite-code/");
    expect(result.current.data).toBe("9f2c-1111");
  });

  it("no pide nada con `enabled: false` (comunidad no privada o sin gestión)", () => {
    renderHook(() => useCommunityInviteCode("c1", { enabled: false }), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("403 → `sin_permiso`, con el `error` del backend tal cual", async () => {
    // El endpoint responde `{"error": …}`, no `{"detail": …}`.
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(403, { error: "No tienes permiso para ver el código de invitación" }),
    );

    const { result } = renderHook(() => useCommunityInviteCode("c1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(CommunityInviteCodeError);
    expect(result.current.error?.kind).toBe("sin_permiso");
    expect(result.current.error?.detail).toBe("No tienes permiso para ver el código de invitación");
  });

  it("400 → `no_privada`", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { error: "Solo las comunidades privadas tienen código de invitación" }),
    );

    const { result } = renderHook(() => useCommunityInviteCode("c1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.kind).toBe("no_privada");
  });

  it("cualquier otro fallo → `desconocido`", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCommunityInviteCode("c1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.kind).toBe("desconocido");
    expect(result.current.error?.detail).toBeUndefined();
  });
});
