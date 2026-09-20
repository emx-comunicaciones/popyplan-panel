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
import { buildEntityCommunityRow } from "@/test-utils/fixtures/community";

import { UpdateCommunityError, useUpdateCommunity } from "./useUpdateCommunity";

afterEach(() => {
  apiFetchMock.mockReset();
});

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

describe("useUpdateCommunity", () => {
  it("manda PATCH /api/communities/{id}/ con los campos editables, sin space", async () => {
    const updated = buildEntityCommunityRow({ space: "members", name: "Corredores" });
    apiFetchMock.mockResolvedValueOnce(updated);
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateCommunity(), { wrapper: Wrapper });
    result.current.mutate({
      orgId: 7,
      communityId: "c1",
      space: "members",
      name: "Corredores",
      description: "Paseos matutinos",
      visibility: "on_request",
      codeOfConduct: "Sé amable",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/c1/", {
      method: "PATCH",
      body: {
        name: "Corredores",
        description: "Paseos matutinos",
        visibility: "on_request",
        code_of_conduct: "Sé amable",
      },
    });
  });

  it("400 surge como invalido con el detalle del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "El nombre es obligatorio." }));
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateCommunity(), { wrapper: Wrapper });
    result.current.mutate({ orgId: 7, communityId: "c1", space: "members", name: "" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(UpdateCommunityError);
    expect(result.current.error?.kind).toBe("invalido");
    expect(result.current.error?.message).toBe("El nombre es obligatorio.");
    expect(result.current.error?.detail).toBe("El nombre es obligatorio.");
  });

  it("400 sin detail ni error cae al mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, {}));
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateCommunity(), { wrapper: Wrapper });
    result.current.mutate({ orgId: 7, communityId: "c1", space: "members", name: "Comunidad" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Revisa los datos: alguno no es válido.");
    expect(result.current.error?.detail).toBeUndefined();
  });

  it("400 por campo extrae el mensaje del campo rechazado", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { name: ["Este campo no puede estar en blanco."] }));
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateCommunity(), { wrapper: Wrapper });
    result.current.mutate({ orgId: 7, communityId: "c1", space: "members", name: "" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Este campo no puede estar en blanco.");
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, {}));
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateCommunity(), { wrapper: Wrapper });
    result.current.mutate({ orgId: 7, communityId: "c1", space: "members", name: "Comunidad" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sin_permiso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateCommunity(), { wrapper: Wrapper });
    result.current.mutate({ orgId: 7, communityId: "c1", space: "members", name: "Comunidad" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });

  it("con space:'members', invalida el listado y la ficha, pero no el resumen de Familias", async () => {
    apiFetchMock.mockResolvedValueOnce(buildEntityCommunityRow({ space: "members" }));
    const { Wrapper, queryClient } = makeWrapper();
    queryClient.setQueryData(["panel-entity-communities", 7], []);
    queryClient.setQueryData(["panel-community", "c1"], {});
    queryClient.setQueryData(["panel-families-summary", 7], {});

    const { result } = renderHook(() => useUpdateCommunity(), { wrapper: Wrapper });
    result.current.mutate({ orgId: 7, communityId: "c1", space: "members", name: "Comunidad" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(["panel-entity-communities", 7])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["panel-community", "c1"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["panel-families-summary", 7])?.isInvalidated).toBe(false);
  });

  it("con space:'families', invalida además el resumen de Familias", async () => {
    apiFetchMock.mockResolvedValueOnce(buildEntityCommunityRow({ space: "families" }));
    const { Wrapper, queryClient } = makeWrapper();
    queryClient.setQueryData(["panel-entity-communities", 7], []);
    queryClient.setQueryData(["panel-families-summary", 7], {});

    const { result } = renderHook(() => useUpdateCommunity(), { wrapper: Wrapper });
    result.current.mutate({ orgId: 7, communityId: "c1", space: "families", name: "Comunidad" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(["panel-families-summary", 7])?.isInvalidated).toBe(true);
  });
});
