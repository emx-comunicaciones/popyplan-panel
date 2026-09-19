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
import { buildOrganization } from "@/test-utils/fixtures/organization";

import { useSetOrganizationTerritory } from "./useSetOrganizationTerritory";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useSetOrganizationTerritory", () => {
  it("manda solo los tres campos de territorio, nunca junto a otros", async () => {
    apiFetchMock.mockResolvedValue(buildOrganization());

    const { result } = renderHook(() => useSetOrganizationTerritory(3), { wrapper });
    result.current.mutate({
      admin_level: "diputacion",
      territory_kind: "provincia",
      territory_code: "20",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/3/", {
      method: "PATCH",
      body: { admin_level: "diputacion", territory_kind: "provincia", territory_code: "20" },
    });
  });

  it("un 400 conserva el mensaje literal del backend", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError(400, { territory_code: ["Ese código no tiene municipios activos."] }),
    );

    const { result } = renderHook(() => useSetOrganizationTerritory(3), { wrapper });
    result.current.mutate({ admin_level: "", territory_kind: "provincia", territory_code: "99" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("invalido");
    expect(result.current.error?.detail).toBe("Ese código no tiene municipios activos.");
  });

  it("un 400 sin mensaje de campo cae al mensaje genérico", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(400, {}));

    const { result } = renderHook(() => useSetOrganizationTerritory(3), { wrapper });
    result.current.mutate({ admin_level: "", territory_kind: "", territory_code: "" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("invalido");
    expect(result.current.error?.message).toBe("Revisa el territorio: alguno de los datos no es válido.");
  });

  it("un 403 es kind 'sin_permiso'", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, {}));

    const { result } = renderHook(() => useSetOrganizationTerritory(3), { wrapper });
    result.current.mutate({ admin_level: "", territory_kind: "", territory_code: "" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sin_permiso");
  });

  it("cualquier otro fallo es kind 'desconocido' e invalida el listado y la ficha", async () => {
    apiFetchMock.mockRejectedValue(new Error("red caída"));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["panel-organizations", ""], { count: 0 });
    queryClient.setQueryData(["panel-organization", 3], buildOrganization());

    const { result } = renderHook(() => useSetOrganizationTerritory(3), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate({ admin_level: "", territory_kind: "", territory_code: "" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });

  it("un envío que sale bien invalida el listado y la ficha de la entidad", async () => {
    const updated = buildOrganization({ admin_level: "diputacion" });
    apiFetchMock.mockResolvedValue(updated);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetOrganizationTerritory(3), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate({ admin_level: "diputacion", territory_kind: "provincia", territory_code: "20" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["panel-organizations"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["panel-organization", 3] });
  });
});
