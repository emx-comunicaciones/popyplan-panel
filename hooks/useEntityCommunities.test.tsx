import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { buildEntityCommunityRow } from "@/test-utils/fixtures/community";

import { EntityCommunitiesError, useEntityCommunities } from "./useEntityCommunities";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useEntityCommunities", () => {
  it("filtra por owner.id === orgId entre las comunidades visibles", async () => {
    const mine = buildEntityCommunityRow({ id: "c1", owner: { type: "organization", id: 7, name: "Alfaville", verified: true } });
    const other = buildEntityCommunityRow({ id: "c2", owner: { type: "organization", id: 9, name: "Otra", verified: true } });
    const personal = buildEntityCommunityRow({ id: "c3", owner: { type: "profile", id: 42, name: "Ana", verified: false } });
    apiFetchMock.mockResolvedValueOnce({ count: 3, next: null, previous: null, results: [mine, other, personal] });

    const { result } = renderHook(() => useEntityCommunities(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/?page=1");
    expect(result.current.data).toEqual([mine]);
  });

  it("recorre varias páginas hasta que `next` es null", async () => {
    const page1 = buildEntityCommunityRow({ id: "c1", owner: { type: "organization", id: 7, name: "Alfaville", verified: true } });
    const page2 = buildEntityCommunityRow({ id: "c2", owner: { type: "organization", id: 7, name: "Alfaville", verified: true } });
    apiFetchMock
      .mockResolvedValueOnce({ count: 2, next: "http://api.test/?page=2", previous: null, results: [page1] })
      .mockResolvedValueOnce({ count: 2, next: null, previous: null, results: [page2] });

    const { result } = renderHook(() => useEntityCommunities(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "/api/communities/?page=1");
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/communities/?page=2");
    expect(result.current.data).toEqual([page1, page2]);
  });

  it("concatena las tres páginas de la entidad en un solo listado", async () => {
    const rows = [1, 2, 3].map((n) =>
      buildEntityCommunityRow({
        id: `c${n}`,
        owner: { type: "organization", id: 7, name: "Alfaville", verified: true },
      }),
    );
    apiFetchMock
      .mockResolvedValueOnce({ count: 3, next: "http://api.test/?page=2", previous: null, results: [rows[0]] })
      .mockResolvedValueOnce({ count: 3, next: "http://api.test/?page=3", previous: null, results: [rows[1]] })
      .mockResolvedValueOnce({ count: 3, next: null, previous: null, results: [rows[2]] });

    const { result } = renderHook(() => useEntityCommunities(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.data).toEqual(rows);
  });

  it("avisa en vez de truncar en silencio cuando `next` sigue vivo tras el tope de páginas", async () => {
    // El backend nunca deja de mandar `next`: sin este aviso, el hook
    // devolvería 250 páginas como si fueran todas y la entidad no vería
    // sus últimas comunidades en ningún select del panel.
    apiFetchMock.mockResolvedValue({
      count: 99999,
      next: "http://api.test/?page=999",
      previous: null,
      results: [buildEntityCommunityRow({ id: "c1", owner: { type: "organization", id: 7, name: "Alfaville", verified: true } })],
    });

    const { result } = renderHook(() => useEntityCommunities(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledTimes(250);
    expect(result.current.error).toBeInstanceOf(EntityCommunitiesError);
    expect(result.current.error?.message).toBe(
      "Hay demasiadas comunidades para cargarlas todas; contacta con Popyplan.",
    );
  });

  it("cualquier fallo surge como EntityCommunitiesError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useEntityCommunities(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(EntityCommunitiesError);
  });

  it("dos montajes seguidos con el mismo cliente hacen UNA sola pasada de páginas", async () => {
    // Recorrido paginado caro (hasta 250 peticiones en serie): con el
    // `staleTime` por defecto (0) cada montaje de un select de comunidad
    // lo repetía entero.
    const mine = buildEntityCommunityRow({
      id: "c1",
      owner: { type: "organization", id: 7, name: "Alfaville", verified: true },
    });
    apiFetchMock.mockResolvedValue({ count: 1, next: null, previous: null, results: [mine] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function sharedWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    const first = renderHook(() => useEntityCommunities(7), { wrapper: sharedWrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useEntityCommunities(7), { wrapper: sharedWrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(second.result.current.data).toEqual([mine]);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
