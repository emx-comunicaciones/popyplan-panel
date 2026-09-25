/**
 * `SAFETY.BLOCKS_ADMIN` y `SAFETY.BLOCK_ADMIN_REVOKE` (admin de
 * plataforma, bloque 1). La lista es un array plano de verdad (no la
 * `PaginatedBlockAdminList` del esquema): los mocks usan esa forma.
 */
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
import { buildBlockAdmin } from "@/test-utils/fixtures/platformAccount";

import { BlocksAdminError, useBlocksAdmin, useRevokeBlock } from "./useBlocksAdmin";

afterEach(() => {
  apiFetchMock.mockReset();
});

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
function freshClient() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return queryClient;
}

describe("useBlocksAdmin", () => {
  it("pide los bloqueos de la cuenta (array plano)", async () => {
    freshClient();
    const block = buildBlockAdmin();
    apiFetchMock.mockResolvedValueOnce([block]);
    const { result } = renderHook(() => useBlocksAdmin("13"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([block]);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/blocks/admin/?user=13");
  });

  it("sin cuenta no pide nada", () => {
    freshClient();
    const { result } = renderHook(() => useBlocksAdmin(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [403, "sin_acceso"],
    [404, "no_encontrado"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => useBlocksAdmin("13"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(BlocksAdminError);
    expect(result.current.error?.kind).toBe(kind);
  });
});

describe("useRevokeBlock", () => {
  it("revoca con motivo e invalida la lista", async () => {
    const client = freshClient();
    client.setQueryData(["panel-blocks-admin", "13"], [buildBlockAdmin()]);
    apiFetchMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useRevokeBlock(), { wrapper });
    result.current.mutate({ blockId: "abc", reason: "Acoso resuelto" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/blocks/abc/admin/", {
      method: "DELETE",
      body: { reason: "Acoso resuelto" },
    });
    expect(client.getQueryState(["panel-blocks-admin", "13"])?.isInvalidated).toBe(true);
  });

  it("400 conserva el mensaje del campo reason", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { reason: ["Este campo no puede estar en blanco."] }));
    const { result } = renderHook(() => useRevokeBlock(), { wrapper });
    result.current.mutate({ blockId: "abc", reason: "" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("invalido");
    expect(result.current.error?.detail).toBe("Este campo no puede estar en blanco.");
  });

  it("400 sin mensaje cae al genérico", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));
    const { result } = renderHook(() => useRevokeBlock(), { wrapper });
    result.current.mutate({ blockId: "abc", reason: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.detail).toBeUndefined();
  });

  it.each([
    [403, "sin_acceso"],
    [404, "no_encontrado"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => useRevokeBlock(), { wrapper });
    result.current.mutate({ blockId: "abc", reason: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe(kind);
  });
});
