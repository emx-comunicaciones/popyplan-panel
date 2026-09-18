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

import { PeopleError, usePeople } from "./usePeople";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PERIOD = { since: "2026-01-01", until: "2026-01-31" };

const PAGE = { count: 0, next: null, previous: null, results: [] };

describe("usePeople", () => {
  it("pide since/until sin más filtros", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);

    const { result } = renderHook(() => usePeople(7, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/entidad/7/people/?since=2026-01-01&until=2026-01-31",
    );
  });

  it("añade community/referent/active_since/joined_since/search/page exactos", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);

    const { result } = renderHook(
      () =>
        usePeople(7, PERIOD, {
          community: "comm-uuid",
          referent: 9,
          activeSince: "2026-01-15",
          joinedSince: "2025-01-01",
          search: "ana",
          page: 2,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/entidad/7/people/?since=2026-01-01&until=2026-01-31&community=comm-uuid" +
        "&referent=9&active_since=2026-01-15&joined_since=2025-01-01&search=ana&page=2",
    );
  });

  it("page=1 no se añade a la query (es el valor por defecto del backend)", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);

    const { result } = renderHook(() => usePeople(7, PERIOD, { page: 1 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/entidad/7/people/?since=2026-01-01&until=2026-01-31",
    );
  });

  it("includeInvited añade include_invited=true al final de la query", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);

    const { result } = renderHook(() => usePeople(7, PERIOD, { includeInvited: true }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/entidad/7/people/?since=2026-01-01&until=2026-01-31&include_invited=true",
    );
  });

  it("includeInvited:false no añade nada (igual que omitido)", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);

    const { result } = renderHook(() => usePeople(7, PERIOD, { includeInvited: false }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/entidad/7/people/?since=2026-01-01&until=2026-01-31",
    );
  });

  it("un 400 (filtro inválido) surge como PeopleError 'periodo_invalido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "community inválido." }));

    const { result } = renderHook(() => usePeople(7, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(PeopleError);
    expect((result.current.error as PeopleError).kind).toBe("periodo_invalido");
  });

  it("un 403 (dinamizador, o referente sin ver_lista_nominal) surge como 'sin_acceso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => usePeople(7, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as PeopleError).kind).toBe("sin_acceso");
  });

  it("un 404 (página que ya no existe) surge como 'pagina_inexistente'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, { detail: "Página inválida." }));

    const { result } = renderHook(() => usePeople(7, PERIOD, { page: 3 }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as PeopleError).kind).toBe("pagina_inexistente");
  });

  it("cualquier otro error surge como 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => usePeople(7, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as PeopleError).kind).toBe("desconocido");
  });
});
