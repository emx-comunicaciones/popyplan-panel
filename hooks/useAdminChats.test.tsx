/**
 * `ADMIN_CHATS.LIST`, `ADMIN_CHATS.DETAIL` y `ADMIN_CHATS.MESSAGES`
 * (admin de plataforma, bloque 3). `messages/` es un array plano de
 * verdad (no el `ChatRoom` del esquema): los mocks usan esa forma.
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

import { useAdminChat, useAdminChatMessages, useAdminChats, useSendAdminChatMessage } from "./useAdminChats";

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

describe("useAdminChats", () => {
  it("pide el listado con tipo, búsqueda y página", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] });
    const { result } = renderHook(() => useAdminChats({ chatType: "group", search: " yoga ", page: 3 }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/chats/?page=3&chat_type=group&search=yoga");
  });

  it("sin filtros pide la primera página", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] });
    const { result } = renderHook(() => useAdminChats({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/chats/?page=1");
  });

  it.each([
    [403, "sin_acceso"],
    [404, "no_encontrado"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => useAdminChats({}), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe(kind);
  });
});

describe("useAdminChat / useAdminChatMessages", () => {
  it("pide la sala y sus mensajes", async () => {
    freshClient();
    apiFetchMock.mockImplementation(async (path: string) =>
      path.endsWith("/messages/") ? [{ id: "m1" }] : { id: "r1" },
    );
    const room = renderHook(() => useAdminChat("r1"), { wrapper });
    const messages = renderHook(() => useAdminChatMessages("r1"), { wrapper });
    await waitFor(() => expect(room.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(messages.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/chats/r1/");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/chats/r1/messages/");
    expect(messages.result.current.data).toEqual([{ id: "m1" }]);
  });

  it("traducen sus errores", async () => {
    freshClient();
    apiFetchMock.mockRejectedValue(new ApiError(404, null));
    const room = renderHook(() => useAdminChat("r1"), { wrapper });
    const messages = renderHook(() => useAdminChatMessages("r1"), { wrapper });
    await waitFor(() => expect(room.result.current.isError).toBe(true));
    await waitFor(() => expect(messages.result.current.isError).toBe(true));
    expect(room.result.current.error?.kind).toBe("no_encontrado");
    expect(messages.result.current.error?.kind).toBe("no_encontrado");
  });
});

describe("useSendAdminChatMessage", () => {
  it("manda {content} e invalida los mensajes", async () => {
    freshClient();
    queryClient.setQueryData(["panel-admin-chat-messages", "r1"], []);
    apiFetchMock.mockResolvedValueOnce({ id: "m2" });
    const { result } = renderHook(() => useSendAdminChatMessage("r1"), { wrapper });
    result.current.mutate("Hola");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/chats/r1/messages/", {
      method: "POST",
      body: { content: "Hola" },
    });
    expect(queryClient.getQueryState(["panel-admin-chat-messages", "r1"])?.isInvalidated).toBe(true);
  });

  it("400 con el detail del backend", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { content: "Debes enviar texto o una imagen." }));
    const { result } = renderHook(() => useSendAdminChatMessage("r1"), { wrapper });
    result.current.mutate("");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("invalido");
    expect(result.current.error?.detail).toBe("Debes enviar texto o una imagen.");
  });

  it("400 sin detail y 500", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));
    const { result } = renderHook(() => useSendAdminChatMessage("r1"), { wrapper });
    result.current.mutate("");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Escribe un mensaje.");

    apiFetchMock.mockRejectedValueOnce(new ApiError(500, null));
    result.current.mutate("x");
    await waitFor(() => expect(result.current.error?.kind).toBe("desconocido"));
  });
});
