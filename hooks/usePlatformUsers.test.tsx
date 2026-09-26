/**
 * `USERS.SEARCH` (listado de cuentas del admin de plataforma, bloque 1).
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
import { buildPlatformAccount } from "@/test-utils/fixtures/platformAccount";

import { PlatformUsersError, usePlatformAccount, usePlatformUsers } from "./usePlatformUsers";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });

describe("usePlatformUsers", () => {
  it("pide la página ordenada por alta, sin filtros", async () => {
    apiFetchMock.mockResolvedValueOnce(page([buildPlatformAccount()]));
    const { result } = renderHook(() => usePlatformUsers({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/users/?ordering=-created_at&page=1");
    expect(result.current.data?.knownActive).toBeNull();
    expect(result.current.data?.results).toHaveLength(1);
  });

  it("manda búsqueda, estado, verificación y página; el estado filtrado se conoce", async () => {
    apiFetchMock.mockResolvedValueOnce(page([]));
    const { result } = renderHook(
      () => usePlatformUsers({ search: "  ana ", isActive: false, isVerified: true, page: 3 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/users/users/?ordering=-created_at&page=3&search=ana&is_active=false&is_verified=true",
    );
    expect(result.current.data?.knownActive).toBe(false);
  });

  it.each([
    [403, "sin_acceso"],
    [404, "pagina_inexistente"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => usePlatformUsers({}), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(PlatformUsersError);
    expect(result.current.error?.kind).toBe(kind);
  });

  it("un fallo de red es desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new TypeError("red"));
    const { result } = renderHook(() => usePlatformUsers({}), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});

describe("usePlatformAccount", () => {
  it("localiza la cuenta por correo y la da por activa si no sale entre las desactivadas", async () => {
    const account = buildPlatformAccount({ id: 13, email: "p01@test.com" });
    apiFetchMock.mockImplementation(async (path: string) =>
      path.includes("is_active=false") ? page([]) : page([buildPlatformAccount({ id: 99 }), account]),
    );
    const { result } = renderHook(() => usePlatformAccount("13", " p01@test.com "), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ account, isActive: true });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/users/?ordering=-created_at&search=p01%40test.com");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/users/users/?ordering=-created_at&search=p01%40test.com&is_active=false",
    );
  });

  it("la da por desactivada si sale en la búsqueda con is_active=false", async () => {
    const account = buildPlatformAccount({ id: 13 });
    apiFetchMock.mockResolvedValue(page([account]));
    const { result } = renderHook(() => usePlatformAccount("13", "x@test.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isActive).toBe(false);
  });

  it("devuelve account null si ninguna cuenta con ese correo tiene ese id", async () => {
    apiFetchMock.mockResolvedValue(page([buildPlatformAccount({ id: 5 })]));
    const { result } = renderHook(() => usePlatformAccount("13", "x@test.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.account).toBeNull();
  });

  it("con 20 coincidencias o más, recorre las páginas hasta dar con la cuenta (en las dos búsquedas)", async () => {
    // `search` es un icontains con PAGE_SIZE 20: `ana@x.com` casa también
    // con `mariana@x.com`, `ana@x.com.es`… y la cuenta puede no estar en
    // la primera página. Antes se decía «No se encontró la cuenta».
    const account = buildPlatformAccount({ id: 13, email: "ana@x.com" });
    const others = (from: number) =>
      Array.from({ length: 20 }, (_, i) => buildPlatformAccount({ id: from + i, email: `x${from + i}ana@x.com` }));
    const paged = (results: unknown[], next: string | null) => ({ count: 41, next, previous: null, results });
    apiFetchMock.mockImplementation(async (path: string) => {
      const inactive = path.includes("is_active=false");
      if (path.includes("page=3")) return paged(inactive ? [account] : [], null);
      if (path.includes("page=2")) return paged(inactive ? others(200) : [account], inactive ? "p3" : null);
      return paged(others(inactive ? 100 : 300), "p2");
    });

    const { result } = renderHook(() => usePlatformAccount("13", "ana@x.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ account, isActive: false });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/users/?ordering=-created_at&search=ana%40x.com&page=2");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/users/users/?ordering=-created_at&search=ana%40x.com&is_active=false&page=3",
    );
    // La búsqueda normal para en cuanto la encuentra: no pide la página 3.
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/users/users/?ordering=-created_at&search=ana%40x.com&page=3");
  });

  it("se agotan las páginas sin encontrarla: account null y activa", async () => {
    apiFetchMock.mockImplementation(async (path: string) =>
      path.includes("page=2")
        ? { count: 21, next: null, previous: null, results: [buildPlatformAccount({ id: 7 })] }
        : { count: 21, next: "p2", previous: null, results: [buildPlatformAccount({ id: 5 })] },
    );
    const { result } = renderHook(() => usePlatformAccount("13", "x@test.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ account: null, isActive: true });
  });

  it("con más páginas que el tope, falla en voz alta en vez de decir «no encontrada»", async () => {
    apiFetchMock.mockResolvedValue({ count: 99999, next: "otra", previous: null, results: [buildPlatformAccount({ id: 5 })] });
    const { result } = renderHook(() => usePlatformAccount("13", "a"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("demasiadas_coincidencias");
  });

  it("sin correo no pide nada", () => {
    const { result } = renderHook(() => usePlatformAccount("13", null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("traduce un 403", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, null));
    const { result } = renderHook(() => usePlatformAccount("13", "x@test.com"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sin_acceso");
  });
});
