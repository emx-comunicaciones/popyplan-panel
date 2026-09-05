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
import { buildCommunityMember } from "@/test-utils/fixtures/community";

import {
  CommunityMemberActionError,
  useApproveCommunityMember,
  useChangeCommunityMemberRole,
  useKickCommunityMember,
  useRejectCommunityMember,
} from "./useCommunityMemberActions";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useApproveCommunityMember", () => {
  it("hace POST a approve", async () => {
    const approved = buildCommunityMember({ status: "active" });
    apiFetchMock.mockResolvedValueOnce(approved);

    const { result } = renderHook(() => useApproveCommunityMember(), { wrapper });
    result.current.mutate({ communityId: "c1", memberId: "m1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/c1/members/m1/approve/", {
      method: "POST",
    });
  });

  it("403 muestra el mensaje del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, { error: "No tienes permiso para aprobar solicitudes" }));

    const { result } = renderHook(() => useApproveCommunityMember(), { wrapper });
    result.current.mutate({ communityId: "c1", memberId: "m1" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(CommunityMemberActionError);
    expect(result.current.error?.message).toBe("No tienes permiso para aprobar solicitudes");
  });
});

describe("useRejectCommunityMember", () => {
  it("hace POST a reject", async () => {
    apiFetchMock.mockResolvedValueOnce({ detail: "Solicitud rechazada." });

    const { result } = renderHook(() => useRejectCommunityMember(), { wrapper });
    result.current.mutate({ communityId: "c1", memberId: "m1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/c1/members/m1/reject/", {
      method: "POST",
    });
  });

  it("un fallo que no es ApiError muestra el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useRejectCommunityMember(), { wrapper });
    result.current.mutate({ communityId: "c1", memberId: "m1" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo rechazar la solicitud.");
  });
});

describe("useKickCommunityMember", () => {
  it("hace POST a kick", async () => {
    apiFetchMock.mockResolvedValueOnce({ detail: "Miembro expulsado" });

    const { result } = renderHook(() => useKickCommunityMember(), { wrapper });
    result.current.mutate({ communityId: "c1", memberId: "m1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/c1/members/m1/kick/", {
      method: "POST",
    });
  });

  it("un fallo sin cuerpo con error muestra el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useKickCommunityMember(), { wrapper });
    result.current.mutate({ communityId: "c1", memberId: "m1" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo expulsar a la persona.");
  });
});

describe("useChangeCommunityMemberRole", () => {
  it("hace PATCH con el rol", async () => {
    const promoted = buildCommunityMember({ role: "moderator" });
    apiFetchMock.mockResolvedValueOnce(promoted);

    const { result } = renderHook(() => useChangeCommunityMemberRole(), { wrapper });
    result.current.mutate({ communityId: "c1", memberId: "m1", role: "moderator" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/c1/members/m1/role/", {
      method: "PATCH",
      body: { role: "moderator" },
    });
  });

  it("un fallo que no es ApiError muestra el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useChangeCommunityMemberRole(), { wrapper });
    result.current.mutate({ communityId: "c1", memberId: "m1", role: "member" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo cambiar el rol.");
  });
});
