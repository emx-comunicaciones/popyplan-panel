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

import { OrgScopeError, useOrgScope } from "./useOrgScope";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useOrgScope", () => {
  it("amplía por municipios", async () => {
    apiFetchMock.mockResolvedValueOnce({ added: 2, total: 5 });

    const { result } = renderHook(() => useOrgScope(7), { wrapper });
    result.current.mutate({ places: ["30001", "30002"] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/scope/", {
      method: "POST",
      body: { places: ["30001", "30002"] },
    });
    expect(result.current.data).toEqual({ added: 2, total: 5 });
  });

  it("amplía por comarca", async () => {
    apiFetchMock.mockResolvedValueOnce({ added: 8, total: 8 });

    const { result } = renderHook(() => useOrgScope(7), { wrapper });
    result.current.mutate({ comarca: "vega-alta" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/scope/", {
      method: "POST",
      body: { comarca: "vega-alta" },
    });
  });

  it("400 (sin ninguna clave) muestra el mensaje del contrato", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useOrgScope(7), { wrapper });
    result.current.mutate({ places: [] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(OrgScopeError);
    expect(result.current.error?.message).toBe("Indica municipios, comarca o provincia.");
  });

  it("403 muestra el mensaje de permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useOrgScope(7), { wrapper });
    result.current.mutate({ province: "30" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Solo el titular puede ampliar el ámbito de la entidad.");
  });

  it("cualquier otro fallo muestra el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useOrgScope(7), { wrapper });
    result.current.mutate({ places: ["30001"] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo ampliar el ámbito de la entidad.");
  });
});

/**
 * `lib/api/drfError.ts::detailOf`: el 400 por campo de DRF
 * (`{campo: ["mensaje"]}`) se pinta con el mensaje del backend, no con el
 * genérico del hook.
 */
describe("useOrgScope (400 con detalle)", () => {
  it("muestra el detalle del backend en vez del mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { places: ["Ese código INE no existe."] }));
    const { result } = renderHook(() => useOrgScope(7), { wrapper });
    result.current.mutate({ places: ["99999"] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Ese código INE no existe.");
  });
});
