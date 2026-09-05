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

import {
  PlatformRolesError,
  useGrantPlatformRole,
  usePlatformRoles,
  useRevokePlatformRole,
} from "./usePlatformRoles";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const ROLE = { user: 1, username: "ana", role: "moderator", granted_by: 2, created_at: "2026-09-01T00:00:00Z" };

describe("usePlatformRoles", () => {
  it("lista los roles vigentes", async () => {
    apiFetchMock.mockResolvedValueOnce([ROLE]);
    const { result } = renderHook(() => usePlatformRoles(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([ROLE]);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/platform-roles/");
  });

  it("403 sin acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => usePlatformRoles(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(PlatformRolesError);
  });

  it("cualquier otro fallo", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => usePlatformRoles(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(PlatformRolesError);
  });
});

describe("useGrantPlatformRole", () => {
  it("concede un rol", async () => {
    apiFetchMock.mockResolvedValueOnce(ROLE);
    const { result } = renderHook(() => useGrantPlatformRole(), { wrapper });
    result.current.mutate({ user: 1, role: "moderator" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/safety/platform-roles/",
      expect.objectContaining({ method: "POST", body: { user: 1, role: "moderator" } }),
    );
  });

  it("400 con detail literal", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "Rol inválido." }));
    const { result } = renderHook(() => useGrantPlatformRole(), { wrapper });
    result.current.mutate({ user: 1, role: "moderator" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Rol inválido.");
  });

  it("403 sin permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useGrantPlatformRole(), { wrapper });
    result.current.mutate({ user: 1, role: "moderator" });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("cualquier otro fallo", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => useGrantPlatformRole(), { wrapper });
    result.current.mutate({ user: 1, role: "moderator" });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useRevokePlatformRole", () => {
  it("revoca un rol", async () => {
    apiFetchMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useRevokePlatformRole(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/safety/platform-roles/1/",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("404 sin rol vigente", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));
    const { result } = renderHook(() => useRevokePlatformRole(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("403 sin permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useRevokePlatformRole(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("cualquier otro fallo", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => useRevokePlatformRole(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
