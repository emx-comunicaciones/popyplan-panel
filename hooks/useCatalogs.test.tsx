/**
 * Los catorce `CATALOGS.*` (admin de plataforma, bloque 3):
 * `CATALOGS.LANGUAGES`, `CATALOGS.LANGUAGE`, `CATALOGS.HOBBY_CATEGORIES`,
 * `CATALOGS.HOBBY_CATEGORY`, `CATALOGS.HOBBIES`, `CATALOGS.HOBBY`,
 * `CATALOGS.COMMUNITY_CATEGORIES`, `CATALOGS.COMMUNITY_CATEGORY`,
 * `CATALOGS.COMMUNITY_SUBCATEGORIES`, `CATALOGS.COMMUNITY_SUBCATEGORY`,
 * `CATALOGS.EVENT_CATEGORIES`, `CATALOGS.EVENT_CATEGORY`,
 * `CATALOGS.EVENT_SUBCATEGORIES` y `CATALOGS.EVENT_SUBCATEGORY`. Los mocks
 * usan las tres formas reales de listado: array plano, paginación
 * estándar y `{results, count}`.
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
  CATALOG_CONFIG,
  CATALOG_QUERY_KEY,
  MAX_PAGES,
  useCatalog,
  useDeleteCatalogItem,
  useSaveCatalogItem,
  type CatalogFormValues,
  type CatalogKey,
} from "./useCatalogs";

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

const VALUES: CatalogFormValues = {
  code: " es ",
  label: " Español ",
  order: "3",
  emoji: " 🎨 ",
  parent: "7",
  categoryType: "sports",
  description: " Desc ",
  icon: " ⚽ ",
  isActive: false,
};

describe("useCatalog", () => {
  it("sin catálogo no pide nada", () => {
    freshClient();
    const { result } = renderHook(() => useCatalog(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("idiomas: array plano normalizado", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce([{ id: 1, code: "es", label: "Español", order: 1, is_active: false }]);
    const { result } = renderHook(() => useCatalog("languages"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/catalogs/languages/");
    expect(result.current.data).toEqual([
      {
        id: "1",
        label: "Español",
        code: "es",
        order: 1,
        emoji: null,
        parent: null,
        categoryType: null,
        description: null,
        icon: null,
        count: null,
        isActive: false,
      },
    ]);
  });

  it("aficiones y subcategorías de comunidad: padre desde `category`", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce([{ id: 2, code: "pintura", label: "Pintura", category: 1, is_active: true }]);
    const hobbies = renderHook(() => useCatalog("hobbies"), { wrapper });
    await waitFor(() => expect(hobbies.result.current.isSuccess).toBe(true));
    expect(hobbies.result.current.data?.[0].parent).toBe("1");

    apiFetchMock.mockResolvedValueOnce([{ id: "u1", name: "Yoga", category: "c1", is_active: true }]);
    const subs = renderHook(() => useCatalog("communitySubcategories"), { wrapper });
    await waitFor(() => expect(subs.result.current.isSuccess).toBe(true));
    expect(subs.result.current.data?.[0]).toMatchObject({ label: "Yoga", parent: "c1" });

    apiFetchMock.mockResolvedValueOnce([{ id: 1, code: "creative", label: "Creativos", emoji: "🎨", hobbies: [] }]);
    const cats = renderHook(() => useCatalog("hobbyCategories"), { wrapper });
    await waitFor(() => expect(cats.result.current.isSuccess).toBe(true));
    expect(cats.result.current.data?.[0]).toMatchObject({ label: "Creativos", emoji: "🎨", isActive: true });
  });

  it("categorías de comunidad: recorre todas las páginas", async () => {
    freshClient();
    apiFetchMock
      .mockResolvedValueOnce({ count: 2, next: "x", previous: null, results: [{ id: "a", name: "A", communities_count: 3 }] })
      .mockResolvedValueOnce({ count: 2, next: null, previous: "x", results: [{ id: "b", name: "B", emoji: "🌿" }] });
    const { result } = renderHook(() => useCatalog("communityCategories"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "/api/community-categories/?page=1");
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/community-categories/?page=2");
    expect(result.current.data?.map((item) => [item.label, item.count, item.emoji])).toEqual([
      ["A", 3, null],
      ["B", null, "🌿"],
    ]);
  });

  it("categorías de comunidad: con más páginas que el tope, falla con demasiadas_paginas", async () => {
    freshClient();
    apiFetchMock.mockResolvedValue({ count: 9999, next: "x", previous: null, results: [] });
    const { result } = renderHook(() => useCatalog("communityCategories"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(MAX_PAGES);
    expect(result.current.error?.kind).toBe("demasiadas_paginas");
  });

  it("categorías y subcategorías de actividad: `{results, count}`", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce({
      results: [{ id: 2, name: "Culturales", category_type: "cultural", icon: "🎭", description: "", is_active: true }],
      count: 1,
    });
    const cats = renderHook(() => useCatalog("eventCategories"), { wrapper });
    await waitFor(() => expect(cats.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/event-categories/");
    expect(cats.result.current.data?.[0]).toMatchObject({ categoryType: "cultural", icon: "🎭", description: null });

    apiFetchMock.mockResolvedValueOnce({ results: [{ id: "s1", name: "Arte", category_id: "2", is_active: true }], count: 1 });
    const subs = renderHook(() => useCatalog("eventSubcategories"), { wrapper });
    await waitFor(() => expect(subs.result.current.isSuccess).toBe(true));
    expect(subs.result.current.data?.[0].parent).toBe("2");
  });

  it.each([
    [403, "sin_acceso"],
    [404, "no_encontrado"],
    [500, "conflicto_servidor"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => useCatalog("languages"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe(kind);
  });

  it("un error que no es de la API es desconocido", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    const { result } = renderHook(() => useCatalog("hobbyCategories"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});

describe("toPayload de cada catálogo", () => {
  const cases: [CatalogKey, Record<string, unknown>][] = [
    ["languages", { code: "es", label: "Español", order: 3, is_active: false }],
    ["hobbyCategories", { code: "es", label: "Español", order: 3, is_active: false, emoji: "🎨" }],
    ["hobbies", { code: "es", label: "Español", order: 3, is_active: false, category: 7 }],
    ["communityCategories", { name: "Español", emoji: "🎨", is_active: false }],
    ["communitySubcategories", { name: "Español", category: "7", is_active: false }],
    ["eventCategories", { name: "Español", category_type: "sports", icon: "⚽", description: "Desc", is_active: false }],
    ["eventSubcategories", { name: "Español", category: 7, is_active: false }],
  ];
  it.each(cases)("%s", (key, expected) => {
    expect(CATALOG_CONFIG[key].toPayload(VALUES)).toEqual(expected);
  });

  it("un orden no válido se manda como 0", () => {
    expect(CATALOG_CONFIG.languages.toPayload({ ...VALUES, order: "-2" })).toMatchObject({ order: 0 });
    expect(CATALOG_CONFIG.languages.toPayload({ ...VALUES, order: "abc" })).toMatchObject({ order: 0 });
  });
});

describe("useSaveCatalogItem / useDeleteCatalogItem", () => {
  const detailCases: [CatalogKey, string, string][] = [
    ["languages", "/api/catalogs/languages/", "/api/catalogs/languages/9/"],
    ["hobbyCategories", "/api/catalogs/hobby-categories/", "/api/catalogs/hobby-categories/9/"],
    ["hobbies", "/api/catalogs/hobbies/", "/api/catalogs/hobbies/9/"],
    ["communityCategories", "/api/community-categories/", "/api/community-categories/9/"],
    ["communitySubcategories", "/api/community-subcategories/", "/api/community-subcategories/9/"],
    ["eventCategories", "/api/event-categories/", "/api/event-categories/9/"],
    ["eventSubcategories", "/api/event-subcategories/", "/api/event-subcategories/9/"],
  ];

  it.each(detailCases)("%s: POST al listado, PATCH y DELETE al detalle", async (key, list, detail) => {
    const client = freshClient();
    client.setQueryData([CATALOG_QUERY_KEY, key], []);
    apiFetchMock.mockResolvedValue({});
    const save = renderHook(() => useSaveCatalogItem(key), { wrapper });
    await save.result.current.mutateAsync({ id: null, values: VALUES });
    expect(apiFetchMock).toHaveBeenLastCalledWith(list, { method: "POST", body: CATALOG_CONFIG[key].toPayload(VALUES) });
    await save.result.current.mutateAsync({ id: "9", values: VALUES });
    expect(apiFetchMock).toHaveBeenLastCalledWith(detail, { method: "PATCH", body: CATALOG_CONFIG[key].toPayload(VALUES) });

    const remove = renderHook(() => useDeleteCatalogItem(key), { wrapper });
    await remove.result.current.mutateAsync("9");
    expect(apiFetchMock).toHaveBeenLastCalledWith(detail, { method: "DELETE" });
    await waitFor(() => expect(client.getQueryState([CATALOG_QUERY_KEY, key])?.isInvalidated).toBe(true));
  });

  it("un 400 al guardar trae el detalle; un 500 al borrar es conflicto_servidor", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { code: ["Ya existe."] }));
    const save = renderHook(() => useSaveCatalogItem("languages"), { wrapper });
    save.result.current.mutate({ id: null, values: VALUES });
    await waitFor(() => expect(save.result.current.isError).toBe(true));
    expect(save.result.current.error?.kind).toBe("invalido");
    expect(save.result.current.error?.detail).toBe("Ya existe.");

    apiFetchMock.mockRejectedValueOnce(new ApiError(500, null));
    const remove = renderHook(() => useDeleteCatalogItem("hobbyCategories"), { wrapper });
    remove.result.current.mutate("1");
    await waitFor(() => expect(remove.result.current.isError).toBe(true));
    expect(remove.result.current.error?.kind).toBe("conflicto_servidor");
  });

  it("un 400 sin detalle legible queda sin detail", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, {}));
    const save = renderHook(() => useSaveCatalogItem("languages"), { wrapper });
    save.result.current.mutate({ id: "1", values: VALUES });
    await waitFor(() => expect(save.result.current.isError).toBe(true));
    expect(save.result.current.error?.detail).toBeUndefined();
  });
});
