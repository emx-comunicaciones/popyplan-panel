import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/client";
import { buildPlaceSheet } from "@/test-utils/fixtures/places";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { usePlaceSheet } from "./usePlaceSheet";

// Mismo wrapper local que `hooks/useMetrics.test.tsx`: este repo no
// tiene un helper compartido de QueryClient para tests de hooks.
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

const PERIOD = { since: "2026-01-01", until: "2026-01-31" };

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("usePlaceSheet", () => {
  it("pide la ficha del municipio con el periodo", async () => {
    apiFetchMock.mockResolvedValue(buildPlaceSheet());

    const { result } = renderHook(() => usePlaceSheet(3, "20069", PERIOD), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/territorio/3/places/20069/?since=2026-01-01&until=2026-01-31",
    );
    expect(result.current.data?.organizations_based_here).toBe(2);
  });

  it("sin ine_code no pide nada (la ficha está cerrada)", () => {
    renderHook(() => usePlaceSheet(3, null, PERIOD), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("un 404 (municipio fuera del territorio) es kind 'fuera_de_territorio'", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(404, { detail: "No encontrado." }));

    const { result } = renderHook(() => usePlaceSheet(3, "28079", PERIOD), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("fuera_de_territorio");
  });

  it("un 403 es kind 'sin_acceso' y un 409 kind 'sin_territorio'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, {}));
    const forbidden = renderHook(() => usePlaceSheet(3, "20069", PERIOD), {
      wrapper,
    });
    await waitFor(() => expect(forbidden.result.current.isError).toBe(true));
    expect(forbidden.result.current.error?.kind).toBe("sin_acceso");

    apiFetchMock.mockRejectedValueOnce(new ApiError(409, { detail: "Sin territorio." }));
    const conflict = renderHook(() => usePlaceSheet(4, "20069", PERIOD), {
      wrapper,
    });
    await waitFor(() => expect(conflict.result.current.isError).toBe(true));
    expect(conflict.result.current.error?.kind).toBe("sin_territorio");
    expect(conflict.result.current.error?.detail).toBe("Sin territorio.");
  });

  it("cualquier otro fallo es kind 'desconocido'", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, {}));

    const { result } = renderHook(() => usePlaceSheet(3, "20069", PERIOD), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});
