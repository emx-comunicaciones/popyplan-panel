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
import { buildProgram } from "@/test-utils/fixtures/program";

import { ProgramError, useProgram } from "./useProgram";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useProgram", () => {
  it("pide la ficha del programa", async () => {
    const program = buildProgram({ id: 3 });
    apiFetchMock.mockResolvedValueOnce(program);

    const { result } = renderHook(() => useProgram(7, 3), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/programs/3/");
    expect(result.current.data).toEqual(program);
  });

  it("403 surge como sin_acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useProgram(7, 3), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as ProgramError).kind).toBe("sin_acceso");
  });

  it("404 surge como no_encontrado", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));

    const { result } = renderHook(() => useProgram(7, 3), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as ProgramError).kind).toBe("no_encontrado");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useProgram(7, 3), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as ProgramError).kind).toBe("desconocido");
  });
});
