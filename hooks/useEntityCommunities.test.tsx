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

const ownedByAlfaville = { type: "organization", id: 7, name: "Alfaville", verified: true } as const;

describe("useEntityCommunities", () => {
  it("pide `?owner_org=` al backend en vez de recorrer el listado global", async () => {
    const mine = buildEntityCommunityRow({ id: "c1", owner: { ...ownedByAlfaville } });
    apiFetchMock.mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [mine] });

    const { result } = renderHook(() => useEntityCommunities(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/?owner_org=7&page=1");
    expect(result.current.data).toEqual([mine]);
  });

  it("no filtra en el cliente: el backend ya devuelve solo las de la entidad", async () => {
    // B-C1 de la auditoría: con `?owner_org=` el titular/moderador recibe
    // TODAS las suyas (privadas y los dos espacios de POP Familias). Un
    // filtro por `owner.id` en el cliente sobraba y, peor, escondía filas
    // que el backend sí autoriza.
    const familias = buildEntityCommunityRow({
      id: "c1",
      space: "families",
      owner: { ...ownedByAlfaville },
    });
    const privada = buildEntityCommunityRow({
      id: "c2",
      visibility: "private",
      owner: { ...ownedByAlfaville },
    });
    apiFetchMock.mockResolvedValueOnce({
      count: 2,
      next: null,
      previous: null,
      results: [familias, privada],
    });

    const { result } = renderHook(() => useEntityCommunities(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([familias, privada]);
  });

  it("recorre varias páginas hasta que `next` es null, siempre con `owner_org`", async () => {
    const page1 = buildEntityCommunityRow({ id: "c1", owner: { ...ownedByAlfaville } });
    const page2 = buildEntityCommunityRow({ id: "c2", owner: { ...ownedByAlfaville } });
    apiFetchMock
      .mockResolvedValueOnce({ count: 2, next: "http://api.test/?page=2", previous: null, results: [page1] })
      .mockResolvedValueOnce({ count: 2, next: null, previous: null, results: [page2] });

    const { result } = renderHook(() => useEntityCommunities(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "/api/communities/?owner_org=7&page=1");
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/communities/?owner_org=7&page=2");
    expect(result.current.data).toEqual([page1, page2]);
  });

  it("avisa en vez de truncar en silencio cuando `next` sigue vivo tras el tope de páginas", async () => {
    // El backend nunca deja de mandar `next`: sin este aviso, el hook
    // devolvería 250 páginas como si fueran todas y la entidad no vería
    // sus últimas comunidades en ningún select del panel.
    apiFetchMock.mockResolvedValue({
      count: 99999,
      next: "http://api.test/?page=999",
      previous: null,
      results: [buildEntityCommunityRow({ id: "c1", owner: { ...ownedByAlfaville } })],
    });

    const { result } = renderHook(() => useEntityCommunities(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledTimes(250);
    expect(result.current.error).toBeInstanceOf(EntityCommunitiesError);
    expect(result.current.error?.kind).toBe("demasiadas_paginas");
    expect(result.current.error?.message).toBe(
      "Hay demasiadas comunidades para cargarlas todas; contacta con Popyplan.",
    );
  });

  it("cualquier fallo surge como EntityCommunitiesError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useEntityCommunities(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(EntityCommunitiesError);
    expect(result.current.error?.kind).toBe("desconocido");
  });
});
