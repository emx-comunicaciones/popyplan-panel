/**
 * `COMMUNITIES.LIST`, `COMMUNITIES.DETAIL`, `COMMUNITY_POSTS.LIST` y
 * `COMMUNITY_POSTS.DETAIL` vistos por la plataforma (admin de
 * plataforma, bloque 3). Los mocks usan la forma real: listados con la
 * paginación estándar de DRF.
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
import {
  COMMUNITY_ID,
  buildPlatformCommunityDetail,
  buildPlatformCommunityPost,
} from "@/test-utils/fixtures/platformCommunity";

import {
  PlatformCommunitiesError,
  useDeleteCommunityPost,
  useDeletePlatformCommunity,
  usePlatformCommunities,
  usePlatformCommunity,
  usePlatformCommunityPosts,
  useSetCommunityPostActive,
  useSetPlatformCommunityActive,
} from "./usePlatformCommunities";

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
const page = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

describe("usePlatformCommunities", () => {
  it("pide la página con búsqueda", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(page([]));
    const { result } = renderHook(() => usePlatformCommunities({ search: " bici ", page: 2 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/?page=2&search=bici");
  });

  it("sin filtros pide la primera página", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(page([]));
    const { result } = renderHook(() => usePlatformCommunities({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/?page=1");
  });

  it.each([
    [403, "sin_acceso"],
    [404, "pagina_inexistente"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => usePlatformCommunities({}), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(PlatformCommunitiesError);
    expect(result.current.error?.kind).toBe(kind);
  });
});

describe("usePlatformCommunity", () => {
  it("pide la ficha", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(buildPlatformCommunityDetail());
    const { result } = renderHook(() => usePlatformCommunity(COMMUNITY_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/communities/${COMMUNITY_ID}/`);
  });

  it("404 → no_encontrado", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));
    const { result } = renderHook(() => usePlatformCommunity(COMMUNITY_ID), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("no_encontrado");
  });
});

describe("useSetPlatformCommunityActive", () => {
  it("manda is_active e invalida ficha y listado", async () => {
    const client = freshClient();
    client.setQueryData(["panel-platform-community", COMMUNITY_ID], buildPlatformCommunityDetail());
    client.setQueryData(["panel-platform-communities", "", 1], page([]));
    apiFetchMock.mockResolvedValueOnce(buildPlatformCommunityDetail({ is_active: false }));
    const { result } = renderHook(() => useSetPlatformCommunityActive(COMMUNITY_ID), { wrapper });
    result.current.mutate(false);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/communities/${COMMUNITY_ID}/`, {
      method: "PATCH",
      body: { is_active: false },
    });
    expect(client.getQueryState(["panel-platform-community", COMMUNITY_ID])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["panel-platform-communities", "", 1])?.isInvalidated).toBe(true);
  });

  it.each([
    [400, "invalido"],
    [403, "sin_acceso"],
    [404, "no_encontrado"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => useSetPlatformCommunityActive(COMMUNITY_ID), { wrapper });
    result.current.mutate(true);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe(kind);
  });

  it("conserva el detalle del backend", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, { error: "Only community managers can edit it" }));
    const { result } = renderHook(() => useSetPlatformCommunityActive(COMMUNITY_ID), { wrapper });
    result.current.mutate(true);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.detail).toBe("Only community managers can edit it");
  });
});

describe("useDeletePlatformCommunity", () => {
  it("borra e invalida el listado", async () => {
    const client = freshClient();
    client.setQueryData(["panel-platform-communities", "", 1], page([]));
    apiFetchMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeletePlatformCommunity(COMMUNITY_ID), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/communities/${COMMUNITY_ID}/`, { method: "DELETE" });
    expect(client.getQueryState(["panel-platform-communities", "", 1])?.isInvalidated).toBe(true);
  });

  it("error → kind", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    const { result } = renderHook(() => useDeletePlatformCommunity(COMMUNITY_ID), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});

describe("usePlatformCommunityPosts", () => {
  it("filtra por comunidad, estado y página", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(page([buildPlatformCommunityPost()]));
    const { result } = renderHook(() => usePlatformCommunityPosts(COMMUNITY_ID, { isActive: false, page: 3 }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/community-posts/?community=${COMMUNITY_ID}&page=3&is_active=false`);
  });

  it("sin estado no manda is_active", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(page([]));
    const { result } = renderHook(() => usePlatformCommunityPosts(COMMUNITY_ID, {}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/community-posts/?community=${COMMUNITY_ID}&page=1`);
  });

  it("404 → pagina_inexistente", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));
    const { result } = renderHook(() => usePlatformCommunityPosts(COMMUNITY_ID, { page: 2 }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("pagina_inexistente");
  });
});

describe("useSetCommunityPostActive y useDeleteCommunityPost", () => {
  it("oculta una publicación e invalida las publicaciones", async () => {
    const client = freshClient();
    client.setQueryData(["panel-platform-community-posts", COMMUNITY_ID, null, 1], page([]));
    apiFetchMock.mockResolvedValueOnce(buildPlatformCommunityPost({ is_active: false }));
    const { result } = renderHook(() => useSetCommunityPostActive(), { wrapper });
    result.current.mutate({ postId: "p1", isActive: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/p1/", {
      method: "PATCH",
      body: { is_active: false },
    });
    expect(client.getQueryState(["panel-platform-community-posts", COMMUNITY_ID, null, 1])?.isInvalidated).toBe(true);
  });

  it("ocultar con error → kind", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));
    const { result } = renderHook(() => useSetCommunityPostActive(), { wrapper });
    result.current.mutate({ postId: "p1", isActive: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("no_encontrado");
  });

  it("borra una publicación", async () => {
    const client = freshClient();
    client.setQueryData(["panel-platform-community-posts", COMMUNITY_ID, null, 1], page([]));
    apiFetchMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeleteCommunityPost(), { wrapper });
    result.current.mutate("p1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/community-posts/p1/", { method: "DELETE" });
    expect(client.getQueryState(["panel-platform-community-posts", COMMUNITY_ID, null, 1])?.isInvalidated).toBe(true);
  });

  it("borrar con error → kind", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, null));
    const { result } = renderHook(() => useDeleteCommunityPost(), { wrapper });
    result.current.mutate("p1");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});
