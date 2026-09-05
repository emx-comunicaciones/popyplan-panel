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

import { PersonError, usePerson } from "./usePerson";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PERIOD = { since: "2026-01-01", until: "2026-01-31" };

describe("usePerson", () => {
  it("pide la ruta y la query exactas", async () => {
    const detail = { user_id: 42, public_name: "Ana" };
    apiFetchMock.mockResolvedValueOnce(detail);

    const { result } = renderHook(() => usePerson(7, 42, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/entidad/7/people/42/?since=2026-01-01&until=2026-01-31",
    );
    expect(result.current.data).toEqual(detail);
  });

  it("un 404 (referente sin Reference hacia esa persona) surge como 'sin_acceso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, { detail: "No existe esa persona en esta entidad." }));

    const { result } = renderHook(() => usePerson(7, 42, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(PersonError);
    expect((result.current.error as PersonError).kind).toBe("sin_acceso");
  });

  it("un 403 también surge como 'sin_acceso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => usePerson(7, 42, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as PersonError).kind).toBe("sin_acceso");
  });

  it("un 400 surge como 'periodo_invalido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => usePerson(7, 42, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as PersonError).kind).toBe("periodo_invalido");
  });

  it("cualquier otro error surge como 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => usePerson(7, 42, PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as PersonError).kind).toBe("desconocido");
  });
});
